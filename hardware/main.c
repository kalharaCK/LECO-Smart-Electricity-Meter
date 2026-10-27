#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdarg.h>
#include "NuMicro.h"

// ==========================================
// USER SETTINGS & CONFIGURATION
// ==========================================
#define METER_UART          UART4   
#define MODEM_UART          UART0   
#define DEBUG_UART          UART5   

#define METER_RXBUFSIZE     128
#define MODEM_RXBUFSIZE     256
#define SEND_INTERVAL_MS    30000   // 30 seconds

// APN and TCP Settings
#define APN_NAME            "ppwap" 
#define TCP_SERVER          "0.tcp.in.ngrok.io"
#define TCP_PORT            20741

// Security Settings
#define METER_ID            "METER-001"         
#define SECRET_KEY          "MySecretKey123"    

// ==========================================
// GLOBAL VARIABLES (Prevents Stack Overflow)
// ==========================================
uint8_t  g_u8RecData[METER_RXBUFSIZE] = {0};
uint32_t g_u32comRbytes = 0;
int      sequence_counter = 0;

char     g_ModemRxBuf[MODEM_RXBUFSIZE] = {0};
uint32_t g_ModemRxLen = 0;

char     g_timestamp[32] = {0};
char     g_dbg_buf[256] = {0};
char     g_hash_buf[256] = {0};

// Chunking & Encryption Buffers
char     g_plaintext[128] = {0};
char     g_ciphertext[256] = {0}; 
char     g_json_payload[256] = {0};

typedef struct {
    int voltage;
    int current;
    int active_power;
    int total_energy;
} MeterData_t;

MeterData_t current_reading = {0};

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
void SYS_Init(void)
{
    SYS_UnlockReg();
    CLK_EnableXtalRC(CLK_PWRCTL_HIRCEN_Msk);
    CLK_WaitClockReady(CLK_STATUS_HIRCSTB_Msk);
    CLK_SetHCLK(CLK_CLKSEL0_HCLKSEL_HIRC, CLK_CLKDIV0_HCLK(1));
    CLK->AHBCLK |= (1ul << 0) | (1ul << 1) | (1ul << 2);

    PA->MODE = (PA->MODE & ~(0x3ul << (15 * 2))) | (0x1ul << (15 * 2)); 
    PC->MODE = (PC->MODE & ~(0x3ul << (14 * 2))) | (0x1ul << (14 * 2)); 
    PB->MODE = (PB->MODE & ~(0x3ul << (13 * 2))) | (0x1ul << (13 * 2)); 
    PA15 = 1; PC14 = 1; PB13 = 1; 

    CLK_EnableModuleClock(UART0_MODULE);
    CLK_SetModuleClock(UART0_MODULE, CLK_CLKSEL1_UART0SEL_HIRC, CLK_CLKDIV0_UART0(1));
    SYS->GPB_MFPH = (SYS->GPB_MFPH & ~(SYS_GPB_MFPH_PB8MFP_Msk | SYS_GPB_MFPH_PB9MFP_Msk)) |
                    (SYS_GPB_MFPH_PB8MFP_UART0_RXD | SYS_GPB_MFPH_PB9MFP_UART0_TXD);

    CLK_EnableModuleClock(UART4_MODULE);
    CLK_SetModuleClock(UART4_MODULE, CLK_CLKSEL3_UART4SEL_HIRC, CLK_CLKDIV4_UART4(1));
    SYS->GPA_MFPH = (SYS->GPA_MFPH & ~(SYS_GPA_MFPH_PA12MFP_Msk | SYS_GPA_MFPH_PA13MFP_Msk)) |
                    (SYS_GPA_MFPH_PA12MFP_UART4_TXD | SYS_GPA_MFPH_PA13MFP_UART4_RXD);

    CLK_EnableModuleClock(UART5_MODULE);
    CLK_SetModuleClock(UART5_MODULE, CLK_CLKSEL3_UART5SEL_HIRC, CLK_CLKDIV4_UART5(1));
    SYS->GPB_MFPL = (SYS->GPB_MFPL & ~(SYS_GPB_MFPL_PB4MFP_Msk | SYS_GPB_MFPL_PB5MFP_Msk)) |
                    (SYS_GPB_MFPL_PB4MFP_UART5_RXD | SYS_GPB_MFPL_PB5MFP_UART5_TXD);

    SystemCoreClockUpdate();
    SYS_LockReg();
}

// ==========================================
// CRASH-PROOF DEBUG PRINTING
// ==========================================
void Debug_PrintString(const char* str) {
    while(*str) {
        while(UART_GET_TX_FULL(DEBUG_UART)); 
        DEBUG_UART->DAT = *str++;
    }
}

void Debug_Printf(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vsprintf(g_dbg_buf, format, args); 
    va_end(args);
    Debug_PrintString(g_dbg_buf);
}

void Delay_ms_Quiet(uint32_t ms) {
    while (ms > 0) {
        CLK_SysTickDelay(1000); 
        while (UART_IS_RX_READY(MODEM_UART)) { UART_READ(MODEM_UART); }
        ms--;
    }
}

// ==========================================
// SECURITY: ENCRYPTION & HASHING (Zero Memory Overhead)
// ==========================================
// Simple XOR Encryption converted to Hex format for safe TCP transmission
void Encrypt_And_Hex(const char* input, char* output) 
{
    int len = strlen(input);
    int key_len = strlen(SECRET_KEY);
    for(int i = 0; i < len; i++) {
        uint8_t xor_val = input[i] ^ SECRET_KEY[i % key_len];
        sprintf(output + (i * 2), "%02X", xor_val);
    }
}

// FNV-1a Hash generates a signature based on Encrypted Data + Secret Key
uint32_t Calculate_Signature(const char* hex_data)
{
    sprintf(g_hash_buf, "%s%s", hex_data, SECRET_KEY);
    uint32_t hash = 2166136261u;
    int len = strlen(g_hash_buf);
    
    for (int j = 0; j < len; j++) {
        hash ^= (uint8_t)g_hash_buf[j];
        hash *= 16777619u;
    }
    return hash; 
}

// ==========================================
// LIGHTWEIGHT MODEM REDUNDANCY LOGIC
// ==========================================
void Send_To_Modem(const char* str) {
    while(*str) {
        while(UART_GET_TX_FULL(MODEM_UART)); 
        MODEM_UART->DAT = *str++;
    }
}

bool Modem_Wait_Response(const char* expected, uint32_t timeout_ms) {
    uint32_t time = 0;
    char window[32] = {0}; 
    int len = 0;

    while (time < timeout_ms) {
        while (UART_IS_RX_READY(MODEM_UART)) {
            char c = UART_READ(MODEM_UART);
            if (len < 31) {
                window[len++] = c;
                window[len] = '\0';
            } else {
                for(int k = 0; k < 30; k++) window[k] = window[k+1];
                window[30] = c;
                window[31] = '\0';
            }
            if (strstr(window, expected) != NULL) return true;
        }
        CLK_SysTickDelay(1000);
        time++;
    }
    return false; 
}

void Modem_Init_And_Connect(void) {
    while(1) {
        Debug_Printf("[SYS] Booting BC92 Modem...\r\n");
        PC14 = 0; PB13 = 0;
        Delay_ms_Quiet(1500); 
        PC14 = 1; PB13 = 1;
        Delay_ms_Quiet(15000); 

        Send_To_Modem("ATE0\r\n"); Delay_ms_Quiet(500);
        Send_To_Modem("AT+CGATT?\r\n");
        
        if(Modem_Wait_Response("+CGATT: 1", 5000)) {
            char apn_cmd[64];
            sprintf(apn_cmd, "AT+CGDCONT=1,\"IP\",\"%s\"\r\n", APN_NAME);
            Send_To_Modem(apn_cmd);
            Modem_Wait_Response("OK", 2000);

            Send_To_Modem("AT+CGACT=1,1\r\n");
            if(Modem_Wait_Response("OK", 5000)) {
                Debug_Printf("[SYS] -> Cellular Network Connected!\r\n");
                return;
            }
        }
        Debug_Printf("[SYS] -> Connection Failed. Rebooting...\r\n");
    }
}

void Modem_Get_Time(void) {
    strcpy(g_timestamp, "Unknown_Time"); 
    while (UART_IS_RX_READY(MODEM_UART)) UART_READ(MODEM_UART); 
    Send_To_Modem("AT+CCLK?\r\n");
    
    uint32_t time = 0;
    g_ModemRxLen = 0;
    memset(g_ModemRxBuf, 0, MODEM_RXBUFSIZE);
    
    while (time < 1500) { 
        while (UART_IS_RX_READY(MODEM_UART)) {
            char c = UART_READ(MODEM_UART);
            if (g_ModemRxLen < MODEM_RXBUFSIZE - 1) {
                g_ModemRxBuf[g_ModemRxLen++] = c;
                g_ModemRxBuf[g_ModemRxLen] = '\0';
            }
        }
        if (strstr(g_ModemRxBuf, "OK\r\n") || strstr(g_ModemRxBuf, "ERROR\r\n")) break;
        CLK_SysTickDelay(1000);
        time++;
    }
    
    char* start = strstr(g_ModemRxBuf, "+CCLK: \"");
    if (start) {
        start += 8; 
        char* end = strchr(start, '\"'); 
        if (end && (end - start < 30)) {
            *end = '\0';
            strcpy(g_timestamp, start);
        }
    }
}

bool Modem_Send_TCP(const char* payload) {
    char cmd[128];
    sprintf(cmd, "AT+QIOPEN=1,0,\"TCP\",\"%s\",%d,0,0\r\n", TCP_SERVER, TCP_PORT);
    
    Send_To_Modem(cmd);
    if (!Modem_Wait_Response("+QIOPEN: 0,0", 15000)) {
        Send_To_Modem("AT+QICLOSE=0\r\n"); Delay_ms_Quiet(1000);
        return false;
    }

    Send_To_Modem("AT+QISEND=0\r\n");
    if (!Modem_Wait_Response(">", 5000)) {
        Send_To_Modem("AT+QICLOSE=0\r\n"); Delay_ms_Quiet(1000);
        return false;
    }

    Send_To_Modem(payload);
    Delay_ms_Quiet(200);

    while(UART_GET_TX_FULL(MODEM_UART));
    MODEM_UART->DAT = 0x1A; 
    
    if (!Modem_Wait_Response("SEND OK", 15000)) {
        Send_To_Modem("AT+QICLOSE=0\r\n"); Delay_ms_Quiet(1000);
        return false;
    }

    Send_To_Modem("AT+QIRD=0,100\r\n"); Delay_ms_Quiet(1000);
    Send_To_Modem("AT+QICLOSE=0\r\n"); Delay_ms_Quiet(1000);
    return true; 
}

// ==========================================
// METER HDLC LOGIC
// ==========================================
void UART4_read(void) {
    uint32_t timeout_ms = 2000; 
    memset(g_u8RecData, 0, METER_RXBUFSIZE);
    g_u32comRbytes = 0;
    
    while (timeout_ms > 0) {
        while (UART_IS_RX_READY(METER_UART)) {
            if (g_u32comRbytes < METER_RXBUFSIZE) g_u8RecData[g_u32comRbytes++] = UART_READ(METER_UART);
            else UART_READ(METER_UART); 
        }
        if (g_u32comRbytes > 0 && !UART_IS_RX_READY(METER_UART)) {
            Delay_ms_Quiet(30); 
            if (!UART_IS_RX_READY(METER_UART)) break; 
        }
        Delay_ms_Quiet(1); timeout_ms--;
    }
}

uint16_t crc16_x25(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    while (len--) {
        crc ^= *data++;
        for (int i = 0; i < 8; ++i) {
            if (crc & 0x0001) crc = (crc >> 1) ^ 0x8408;
            else crc >>= 1;
        }
    }
    crc ^= 0xFFFF;
    return crc;
}

void send_meter_command(uint8_t *frame, size_t len) {
    int crcIndex = len - 3;  
    uint16_t crc = crc16_x25(frame + 1, crcIndex - 1);
    frame[crcIndex] = crc & 0xFF;
    frame[crcIndex + 1] = (crc >> 8) & 0xFF;
    UART_Write(METER_UART, frame, len);
}

bool Meter_Init_And_Authenticate(void) {
    uint8_t handshake_frame[] = {0x7e, 0xa0, 0x07, 0x03, 0x09, 0x93, 0xfc, 0xec, 0x7e};
    uint8_t auth_frame[] = {
        0x7E, 0xA0, 0x44, 0x03, 0x09, 0x10, 0x15, 0x69,
        0xE6, 0xE6, 0x00, 0x60, 0x36, 0xA1, 0x09, 0x06,
        0x07, 0x60, 0x85, 0x74, 0x05, 0x08, 0x01, 0x01,
        0x8A, 0x02, 0x07, 0x80, 0x8B, 0x07, 0x60, 0x85,
        0x74, 0x05, 0x08, 0x02, 0x01, 0xAC, 0x0A, 0x80,
        0x08, 0x31, 0x31, 0x31, 0x31, 0x31, 0x31, 0x31, 0x31,
        0xBE, 0x10, 0x04, 0x0E, 0x01, 0x00, 0x00, 0x00,
        0x06, 0x5F, 0x1F, 0x04, 0x00, 0x00, 0x1E, 0x1D,
        0xFF, 0xFF, 0xDD, 0x3D, 0x7E
    };

    Debug_Printf("[SYS] Authenticating Meter...\r\n");

    for(int tries = 0; tries < 5; tries++) {
        while (UART_IS_RX_READY(METER_UART)) UART_READ(METER_UART);
        send_meter_command(handshake_frame, sizeof(handshake_frame));
        UART4_read();
        
        if (g_u32comRbytes > 0 && g_u8RecData[0] == 0x7E) {
            Delay_ms_Quiet(500);
            while (UART_IS_RX_READY(METER_UART)) UART_READ(METER_UART);
            send_meter_command(auth_frame, sizeof(auth_frame));
            UART4_read();
            
            if(g_u32comRbytes > 0) return true;
        }
        Delay_ms_Quiet(2000); 
    }
    return false;
}

int extract_value(uint8_t *hdlc_frame, uint32_t len) {
    if(len < 18) return -1; 
    if (hdlc_frame[11] == 0xC4 && hdlc_frame[12] == 0x01 && hdlc_frame[14] == 0x00) {
        uint8_t type = hdlc_frame[15];
        if (type == 0x05 || type == 0x06) {
            if(len < 20) return -1;
            return (hdlc_frame[16]<<24) | (hdlc_frame[17]<<16) | (hdlc_frame[18]<<8) | hdlc_frame[19];
        } else if (type == 0x12 || type == 0x10) {
            if(len < 18) return -1;
            return (hdlc_frame[16]<<8) | hdlc_frame[17];
        } else if (type == 0x0F || type == 0x11) {
            if(len < 17) return -1;
            return hdlc_frame[16];
        }
    }
    return -1; 
}

int read_parameter(uint8_t obis1, uint8_t obis2, uint8_t obis3, uint8_t obis4, uint8_t obis5, uint8_t obis6) {
    int retries = 5; 
    while (retries > 0) {
        uint8_t ctrl0 = (0x10 + sequence_counter * 0x22) & 0xFF;
        uint8_t ctrl1 = (0x8C + sequence_counter * 0x10) & 0xFF;
        uint8_t ctrl2 = (sequence_counter < 4) ? (0x37 - sequence_counter * 2) : (0x3F - (sequence_counter - 4) * 2);

        uint8_t frame[] = {
            0x7E, 0xA0, 0x19, 0x03, 0x09, ctrl0, ctrl1, ctrl2,
            0xE6, 0xE6, 0x00, 0xC0, 0x01, 0xC1, 
            0x00, 0x03, obis1, obis2, obis3, obis4, obis5, obis6, 
            0x02, 0x00, 0x00, 0x00, 0x7E
        };
        sequence_counter = (sequence_counter + 1) % 8; 
        
        while (UART_IS_RX_READY(METER_UART)) UART_READ(METER_UART);
        send_meter_command(frame, sizeof(frame));
        UART4_read();
        
        if (g_u32comRbytes > 0) {
            int val = extract_value(g_u8RecData, g_u32comRbytes);
            if(val != -1) return val; 
        }
        retries--;
        Delay_ms_Quiet(1000); 
    }
    return -1;
}

void Meter_Warm_Up(void) {
    for (int i = 0; i < 3; i++) {
        read_parameter(0x01, 0x00, 0x20, 0x07, 0x00, 0xFF); 
        Delay_ms_Quiet(500);
        read_parameter(0x01, 0x00, 0x1F, 0x07, 0x00, 0xFF); 
        Delay_ms_Quiet(500);
    }
}

// Helper: Generates, Encrypts, and Sends a Chunk
void Send_Chunk(int chunk_id, const char* json_inner) 
{
    // 1. Create inner plaintext JSON
    sprintf(g_plaintext, "{\"C\":%d,\"T\":\"%s\",%s}", chunk_id, g_timestamp, json_inner);
    
    // 2. Encrypt & Convert to Hex
    Encrypt_And_Hex(g_plaintext, g_ciphertext);

    // 3. Hash to generate Signature
    uint32_t signature = Calculate_Signature(g_ciphertext);

    // 4. Construct Final Safe Payload
    sprintf(g_json_payload, "{\"ID\":\"%s\",\"D\":\"%s\",\"S\":%u}", METER_ID, g_ciphertext, signature);

    Debug_Printf("[SYS] Sending Chunk %d...\r\n", chunk_id);
    if (!Modem_Send_TCP(g_json_payload)) {
        Debug_Printf("[SYS] -> Chunk %d Failed!\r\n", chunk_id);
    } else {
        Debug_Printf("[SYS] -> Chunk %d OK!\r\n", chunk_id);
    }
}

// ==========================================
// MAIN LOOP
// ==========================================
int main()
{
    SYS_Init();
    
    UART_Open(DEBUG_UART, 115200);           
    UART_Open(MODEM_UART, 9600);  
    UART_Open(METER_UART, 2400);  

    Debug_Printf("\r\n\r\n=================================\r\n");
    Debug_Printf("  METER -> SECURE CHUNK GATEWAY  \r\n");
    Debug_Printf("=================================\r\n");

    Modem_Init_And_Connect();

    while(!Meter_Init_And_Authenticate()) { Delay_ms_Quiet(3000); }
    sequence_counter = (sequence_counter + 1) % 8; 
    Meter_Warm_Up();

    while(1)
    {
        Debug_Printf("\r\n[SYS] Collecting Meter Data...\r\n");

        current_reading.voltage      = read_parameter(0x01, 0x00, 0x20, 0x07, 0x00, 0xFF); 
        current_reading.current      = read_parameter(0x01, 0x00, 0x1F, 0x07, 0x00, 0xFF); 
        current_reading.active_power = read_parameter(0x01, 0x00, 0x01, 0x07, 0x00, 0xFF); 
        current_reading.total_energy = read_parameter(0x01, 0x00, 0x01, 0x08, 0x00, 0xFF);

        if(current_reading.voltage == -1 && current_reading.total_energy == -1) {
            Debug_Printf("[SYS] Error: Meter Unresponsive. Reconnecting...\r\n");
            if (Meter_Init_And_Authenticate()) {
                sequence_counter = (sequence_counter + 1) % 8; 
                Meter_Warm_Up();
            }
            continue; 
        }

        // Get Timestamp ONCE so both chunks match in backend database!
        Modem_Get_Time();

        // ----------------------------------------------------
        // CHUNK 1: Voltage and Current
        // ----------------------------------------------------
        char temp_data[64];
        sprintf(temp_data, "\"V\":%d,\"I\":%d", current_reading.voltage, current_reading.current);
        Send_Chunk(1, temp_data);

        Delay_ms_Quiet(3000); // 3 sec pause for network breathing room

        // ----------------------------------------------------
        // CHUNK 2: Power and Energy
        // ----------------------------------------------------
        sprintf(temp_data, "\"P\":%d,\"E\":%d", current_reading.active_power, current_reading.total_energy);
        Send_Chunk(2, temp_data);

        Debug_Printf("[SYS] Cycle Done. Sleeping for 30s...\r\n");
        Delay_ms_Quiet(SEND_INTERVAL_MS); 
    }
}