#include <EEPROM.h>
#include "GXDLMSClient.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <ESPAsyncWebSrv.h>

#define CONNECT 2
#define DISCONNECT 1

const char* ssid = "Haito's WiFi";
const char* password = "ADrWF82234";

gxByteBuffer frameData;

const uint32_t WAIT_TIME = 2000;
const uint8_t RESEND_COUNT = 3;

AsyncWebServer server(80);

uint16_t EEPROM_SIZE() {
  return EEPROM.length();
}

int EEPROM_READ(uint16_t index, unsigned char* value) {
  *value = EEPROM.read(index);
  return 0;
}

int EEPROM_WRITE(uint16_t index, unsigned char value) {
  EEPROM.write(index, value);
  return 0;
}

void GXTRACE(const char* str,
             const char* data) {
  //Send trace to the serial port.
  byte c;
  Serial.write("\t:");
  while ((c = pgm_read_byte(str++)) != 0) {
    Serial.write(c);
  }
  if (data != NULL) {
    // Serial.write(data);
  }
  Serial.write("\0");
  Serial.write("\r\n");
  //Serial.flush();
  delay(10);
}

void GXTRACE_INT(const char* str, int32_t value) {
  char data[10];
  sprintf(data, " %ld", value);
  GXTRACE(str, data);
}

uint32_t runTime = 0;

uint32_t time_elapsed(void) {
  return millis();
}

void time_now(gxtime* value) {
  time_addSeconds(value, time_elapsed() / 1000);
}

int com_readSerialPort(
  unsigned char eop) {
  //Read reply data.
  uint16_t pos;
  uint16_t available;
  unsigned char eopFound = 0;
  uint16_t lastReadIndex = frameData.position;
  uint32_t start = millis();
  do {
    available = Serial2.available();
    if (available != 0) {
      if (frameData.size + available > frameData.capacity) {
        bb_capacity(&frameData, 20 + frameData.size + available);
      }
      Serial2.readBytes((char*)(frameData.data + frameData.size), available);
      frameData.size += available;
      //Search eop.
      if (frameData.size > 5) {
        //Some optical strobes can return extra bytes.
        for (pos = frameData.size - 1; pos != lastReadIndex; --pos) {
          if (frameData.data[pos] == eop) {
            eopFound = 1;
            break;
          }
        }
        lastReadIndex = pos;
      }
    } else {
      delay(50);
    }
    //If the meter doesn't reply in given time.
    if (!(millis() - start < WAIT_TIME)) {
      GXTRACE_INT(GET_STR_FROM_EEPROM("Received bytes: \n"), frameData.size);
      return DLMS_ERROR_CODE_RECEIVE_FAILED;
    }
  } while (eopFound == 0);
  return DLMS_ERROR_CODE_OK;
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
}
void sendHTTPRequest(float voltage, float current, float activePower,
                     const String& meterID) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = "http://192.168.0.40:3001/meter";

    http.begin(url);

    http.addHeader("Content-Type", "application/json");

    String jsonData = "{\"voltage\":" + String(voltage) + ",\"current\":" + String(current) + ",\"activePower\":" + String(activePower) + ",\"meterID \":\"" + meterID + "\"}";

    int httpResponseCode = http.POST(jsonData);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response Code: ");
      Serial.println(httpResponseCode);

      // Get the response payload
      String payload = http.getString();
      Serial.println("Response Payload:");
      Serial.println(payload);
    } else {
      Serial.print("HTTP Request failed. Error code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  }
}

void sendImmediateHTTPRequest() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = "http://192.168.0.28:3000/";

    http.begin(url);

    http.addHeader("Content-Type", "application/json");

    String jsonData = "{\"Voltage\":,\"Current limit exceeded\":}";

    int httpResponseCode = http.POST(jsonData);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response Code: ");
      Serial.println(httpResponseCode);

      // Get the response payload
      String payload = http.getString();
      Serial.println("Response Payload:");
      Serial.println(payload);
    } else {
      Serial.print("HTTP Request failed. Error code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  }
}

int readDLMSPacket(
  gxByteBuffer* data,
  gxReplyData* reply) {
  int resend = 0, ret = DLMS_ERROR_CODE_OK;
  if (data->size == 0) {
    return DLMS_ERROR_CODE_OK;
  }
  reply->complete = 0;
  frameData.size = 0;
  frameData.position = 0;
  //Send data.
  if ((ret = Serial2.write(data->data, data->size)) != data->size) {
    //If failed to write all bytes.
    GXTRACE(GET_STR_FROM_EEPROM("Failed to write all data to the serial port.\n"), NULL);
  }
  //Loop until packet is complete.
  do {
    if ((ret = com_readSerialPort(0x7E)) != 0) {
      if (ret == DLMS_ERROR_CODE_RECEIVE_FAILED && resend == RESEND_COUNT) {
        return DLMS_ERROR_CODE_SEND_FAILED;
      }
      ++resend;
      //GXTRACE_INT(GET_STR_FROM_EEPROM("Data send failed. Try to resend."), resend);
      if ((ret = Serial2.write(data->data, data->size)) != data->size) {
        //If failed to write all bytes.
        GXTRACE(GET_STR_FROM_EEPROM("Failed to write all data to the serial port.\n"), NULL);
      }
    }
    ret = Client.GetData(&frameData, reply);
    if (ret != 0 && ret != DLMS_ERROR_CODE_FALSE) {
      break;
    }
  } while (reply->complete == 0);
  return ret;
}

int com_readDataBlock(
  message* messages,
  gxReplyData* reply) {
  gxByteBuffer rr;
  int pos, ret = DLMS_ERROR_CODE_OK;
  //If there is no data to send.
  if (messages->size == 0) {
    return DLMS_ERROR_CODE_OK;
  }
  BYTE_BUFFER_INIT(&rr);
  //Send data.
  for (pos = 0; pos != messages->size; ++pos) {
    //Send data.
    if ((ret = readDLMSPacket(messages->data[pos], reply)) != DLMS_ERROR_CODE_OK) {
      return ret;
    }
    //Check is there errors or more data from server
    while (reply_isMoreData(reply)) {
      if ((ret = Client.ReceiverReady(reply->moreData, &rr)) != DLMS_ERROR_CODE_OK) {
        bb_clear(&rr);
        return ret;
      }
      if ((ret = readDLMSPacket(&rr, reply)) != DLMS_ERROR_CODE_OK) {
        bb_clear(&rr);
        return ret;
      }
      bb_clear(&rr);
    }
  }
  return ret;
}

//Close connection to the meter.
int com_close() {
  int ret = DLMS_ERROR_CODE_OK;
  gxReplyData reply;
  message msg;
  reply_init(&reply);
  mes_init(&msg);
  if ((ret = Client.ReleaseRequest(true, &msg)) != 0 || (ret = com_readDataBlock(&msg, &reply)) != 0) {
    //Show error but continue close.
  }
  reply_clear(&reply);
  mes_clear(&msg);

  if ((ret = Client.DisconnectRequest(&msg)) != 0 || (ret = com_readDataBlock(&msg, &reply)) != 0) {
    //Show error but continue close.
  }
  reply_clear(&reply);
  mes_clear(&msg);
  return ret;
}

//Read Invocation counter (frame counter) from the meter and update it.
int com_updateInvocationCounter(const char* invocationCounter) {
  int ret = DLMS_ERROR_CODE_OK;
  //Read frame counter if security is used.
  if (invocationCounter != NULL && Client.GetSecurity() != DLMS_SECURITY_NONE) {
    uint32_t ic = 0;
    message messages;
    gxReplyData reply;
    unsigned short add = Client.GetClientAddress();
    DLMS_AUTHENTICATION auth = Client.GetAuthentication();
    DLMS_SECURITY security = Client.GetSecurity();
    Client.SetClientAddress(16);
    Client.SetAuthentication(DLMS_AUTHENTICATION_NONE);
    Client.SetSecurity(DLMS_SECURITY_NONE);
    if ((ret = com_initializeConnection()) == DLMS_ERROR_CODE_OK) {
      gxData d;
      cosem_init(BASE(d), DLMS_OBJECT_TYPE_DATA, invocationCounter);
      if ((ret = com_read(BASE(d), 2)) == 0) {
        GXTRACE_INT(GET_STR_FROM_EEPROM("Invocation Counter:"), var_toInteger(&d.value));
        ic = 1 + var_toInteger(&d.value);
      }
      obj_clear(BASE(d));
    }
    //Close connection. It's OK if this fails.
    com_close();
    //Return original settings.
    Client.SetClientAddress(add);
    Client.SetAuthentication(auth);
    Client.SetSecurity(security);
    Client.SetInvocationCounter(ic);
  }
  return ret;
}

//Initialize connection to the meter.
int com_initializeConnection() {
  int ret = DLMS_ERROR_CODE_OK;
  message messages;
  gxReplyData reply;
  mes_init(&messages);
  reply_init(&reply);

#ifndef DLMS_IGNORE_HDLC
  //Get meter's send and receive buffers size.
  if ((ret = Client.SnrmRequest(&messages)) != 0 || (ret = com_readDataBlock(&messages, &reply)) != 0 || (ret = Client.ParseUAResponse(&reply.data)) != 0) {
    mes_clear(&messages);
    reply_clear(&reply);
    return ret;
  }
  mes_clear(&messages);
  reply_clear(&reply);
#endif  //DLMS_IGNORE_HDLC

  if ((ret = Client.AarqRequest(&messages)) != 0 || (ret = com_readDataBlock(&messages, &reply)) != 0 || (ret = Client.ParseAAREResponse(&reply.data)) != 0) {
    mes_clear(&messages);
    reply_clear(&reply);
    if (ret == DLMS_ERROR_CODE_APPLICATION_CONTEXT_NAME_NOT_SUPPORTED) {
      return ret;
    }
    return ret;
  }
  mes_clear(&messages);
  reply_clear(&reply);
  // Get challenge Is HLS authentication is used.
  if (Client.GetAuthentication() > DLMS_AUTHENTICATION_LOW) {
    if ((ret = Client.GetApplicationAssociationRequest(&messages)) != 0 || (ret = com_readDataBlock(&messages, &reply)) != 0 || (ret = Client.ParseApplicationAssociationResponse(&reply.data)) != 0) {
      mes_clear(&messages);
      reply_clear(&reply);
      return ret;
    }
    mes_clear(&messages);
    reply_clear(&reply);
  }
  return DLMS_ERROR_CODE_OK;
}

//Get Association view.
int com_getAssociationView() {
  int ret;
  message data;
  gxReplyData reply;
  mes_init(&data);
  reply_init(&reply);
  if ((ret = Client.GetObjectsRequest(&data)) != 0 || (ret = com_readDataBlock(&data, &reply)) != 0 || (ret = Client.ParseObjects(&reply.data)) != 0) {}
  mes_clear(&data);
  reply_clear(&reply);
  return ret;
}

//Read object.
int com_read(
  gxObject* object,
  unsigned char attributeOrdinal) {
  int ret;
  message data;
  gxReplyData reply;
  mes_init(&data);
  reply_init(&reply);
  if ((ret = Client.Read(object, attributeOrdinal, &data)) != 0 || (ret = com_readDataBlock(&data, &reply)) != 0 || (ret = Client.UpdateValue(object, attributeOrdinal, &reply.dataValue)) != 0) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_read failed."), ret);
  }
  mes_clear(&data);
  reply_clear(&reply);
  return ret;
}

int com_write(
  gxObject* object,
  unsigned char attributeOrdinal) {
  int ret;
  message data;
  gxReplyData reply;
  mes_init(&data);
  reply_init(&reply);
  if ((ret = Client.Write(object, attributeOrdinal, &data)) != 0 || (ret = com_readDataBlock(&data, &reply)) != 0) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_write failed."), ret);
  }
  mes_clear(&data);
  reply_clear(&reply);
  return ret;
}

int com_method(
  gxObject* object,
  unsigned char attributeOrdinal,
  dlmsVARIANT* params) {
  int ret;
  message messages;
  gxReplyData reply;
  mes_init(&messages);
  reply_init(&reply);
  if ((ret = Client.Method(object, attributeOrdinal, params, &messages)) != 0 || (ret = com_readDataBlock(&messages, &reply)) != 0) {
    //GXTRACE_INT(GET_STR_FROM_EEPROM("com_method failed."), ret);
  }
  mes_clear(&messages);
  reply_clear(&reply);
  return ret;
}

//Read objects.
int com_readList(
  gxArray* list) {
  int pos, ret = DLMS_ERROR_CODE_OK;
  gxByteBuffer bb, rr;
  message messages;
  gxReplyData reply;
  if (list->size != 0) {
    mes_init(&messages);
    if ((ret = Client.ReadList(list, &messages)) != 0) {
      GXTRACE_INT(GET_STR_FROM_EEPROM("com_readList failed."), ret);
    } else {
      reply_init(&reply);
      BYTE_BUFFER_INIT(&rr);
      BYTE_BUFFER_INIT(&bb);
      //Send data.
      for (pos = 0; pos != messages.size; ++pos) {
        //Send data.
        reply_clear(&reply);
        if ((ret = readDLMSPacket(messages.data[pos], &reply)) != DLMS_ERROR_CODE_OK) {
          break;
        }
        //Check is there errors or more data from server
        while (reply_isMoreData(&reply)) {
          if ((ret = Client.ReceiverReady(reply.moreData, &rr)) != DLMS_ERROR_CODE_OK || (ret = readDLMSPacket(&rr, &reply)) != DLMS_ERROR_CODE_OK) {
            break;
          }
          bb_clear(&rr);
        }
        bb_set2(&bb, &reply.data, reply.data.position, -1);
      }
      if (ret == 0) {
        ret = Client.UpdateValues(list, &bb);
      }
      bb_clear(&bb);
      bb_clear(&rr);
      reply_clear(&reply);
    }
    mes_clear(&messages);
  }
  return ret;
}

int com_readRowsByEntry(
  gxProfileGeneric* object,
  unsigned long index,
  unsigned long count) {
  int ret;
  message data;
  gxReplyData reply;
  mes_init(&data);
  reply_init(&reply);
  if ((ret = Client.ReadRowsByEntry(object, index, count, &data)) != 0 || (ret = com_readDataBlock(&data, &reply)) != 0 || (ret = Client.UpdateValue((gxObject*)object, 2, &reply.dataValue)) != 0) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_readRowsByEntry failed."), ret);
  }
  mes_clear(&data);
  reply_clear(&reply);
  return ret;
}

///////////////////////////////////////////////////////////////////////////////////
int com_readRowsByRange(
  gxProfileGeneric* object,
  gxtime* start,
  gxtime* end) {
  int ret;
  message data;
  gxReplyData reply;
  mes_init(&data);
  reply_init(&reply);
  if ((ret = Client.ReadRowsByRange(object, start, end, &data)) != 0 || (ret = com_readDataBlock(&data, &reply)) != 0 || (ret = Client.UpdateValue((gxObject*)object, 2, &reply.dataValue)) != 0) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_readRowsByRange failed."), ret);
  }
  mes_clear(&data);
  reply_clear(&reply);
  return ret;
}

//Read scalers and units. They are static so they are read only once.
int com_readScalerAndUnits() {
  gxObject* obj;
  int ret, pos;
  objectArray objects;
  gxArray list;
  gxObject* object;
  DLMS_OBJECT_TYPE types[] = {
    DLMS_OBJECT_TYPE_EXTENDED_REGISTER,
    DLMS_OBJECT_TYPE_REGISTER,
    DLMS_OBJECT_TYPE_DEMAND_REGISTER
  };
  oa_init(&objects);
  //Find registers and demand registers and read them.
  ret = oa_getObjects2(Client.GetObjects(), types, 3, &objects);
  if (ret != DLMS_ERROR_CODE_OK) {
    return ret;
  }
  if ((Client.GetNegotiatedConformance() & DLMS_CONFORMANCE_MULTIPLE_REFERENCES) != 0) {
    arr_init(&list);
    //Try to read with list first. All meters do not support it.
    for (pos = 0; pos != Client.GetObjects()->size; ++pos) {
      ret = oa_getByIndex(Client.GetObjects(), pos, &obj);
      if (ret != DLMS_ERROR_CODE_OK) {
        oa_empty(&objects);
        arr_clear(&list);
        return ret;
      }
      if (obj->objectType == DLMS_OBJECT_TYPE_REGISTER || obj->objectType == DLMS_OBJECT_TYPE_EXTENDED_REGISTER) {
        arr_push(&list, key_init(obj, (void*)3));
      } else if (obj->objectType == DLMS_OBJECT_TYPE_DEMAND_REGISTER) {
        arr_push(&list, key_init(obj, (void*)4));
      }
    }
    ret = com_readList(&list);
    arr_clear(&list);
  }
  //If read list failed read items one by one.
  if (ret != 0) {
    for (pos = 0; pos != objects.size; ++pos) {
      ret = oa_getByIndex(&objects, pos, &object);
      if (ret != DLMS_ERROR_CODE_OK) {
        oa_empty(&objects);
        return ret;
      }
      ret = com_read(object, object->objectType == DLMS_OBJECT_TYPE_DEMAND_REGISTER ? 4 : 3);
      if (ret != DLMS_ERROR_CODE_OK) {
        oa_empty(&objects);
        return ret;
      }
    }
  }
  //Do not clear objects list because it will free also objects from association view list.
  oa_empty(&objects);
  return ret;
}

//Read profile generic columns. They are static so they are read only once.
int com_readProfileGenericColumns() {
  int ret, pos;
  objectArray objects;
  gxObject* object;
  oa_init(&objects);
  ret = oa_getObjects(Client.GetObjects(), DLMS_OBJECT_TYPE_PROFILE_GENERIC, &objects);
  if (ret != DLMS_ERROR_CODE_OK) {
    oa_empty(&objects);
    return ret;
  }
  for (pos = 0; pos != objects.size; ++pos) {
    ret = oa_getByIndex(&objects, pos, &object);
    if (ret != DLMS_ERROR_CODE_OK) {
      break;
    }
    ret = com_read(object, 3);
    if (ret != DLMS_ERROR_CODE_OK) {
      break;
    }
  }
  //Do not clear objects list because it will free also objects from association view list.
  oa_empty(&objects);
  return ret;
}

///////////////////////////////////////////////////////////////////////////////////
//Read profile generics rows.
int com_readProfileGenerics() {
  gxtime startTime, endTime;
  int ret, pos;
  char str[50];
  char ln[25];
  char* data = NULL;
  gxByteBuffer ba;
  objectArray objects;
  gxProfileGeneric* pg;
  oa_init(&objects);
  ret = oa_getObjects(Client.GetObjects(), DLMS_OBJECT_TYPE_PROFILE_GENERIC, &objects);
  if (ret != DLMS_ERROR_CODE_OK) {
    //Do not clear objects list because it will free also objects from association view list.
    oa_empty(&objects);
    return ret;
  }
  BYTE_BUFFER_INIT(&ba);
  for (pos = 0; pos != objects.size; ++pos) {
    ret = oa_getByIndex(&objects, pos, (gxObject**)&pg);
    if (ret != DLMS_ERROR_CODE_OK) {
      //Do not clear objects list because it will free also objects from association view list.
      oa_empty(&objects);
      return ret;
    }
    //Read entries in use.
    ret = com_read((gxObject*)pg, 7);
    if (ret != DLMS_ERROR_CODE_OK) {
      printf("Failed to read object %s %s attribute index %d\r\n", str, ln, 7);
      //Do not clear objects list because it will free also objects from association view list.
      oa_empty(&objects);
      return ret;
    }
    //Read entries.
    ret = com_read((gxObject*)pg, 8);
    if (ret != DLMS_ERROR_CODE_OK) {
      printf("Failed to read object %s %s attribute index %d\r\n", str, ln, 8);
      //Do not clear objects list because it will free also objects from association view list.
      oa_empty(&objects);
      return ret;
    }
    printf("Entries: %ld/%ld\r\n", pg->entriesInUse, pg->profileEntries);
    //If there are no columns or rows.
    if (pg->entriesInUse == 0 || pg->captureObjects.size == 0) {
      continue;
    }
    //Read first row from Profile Generic.
    ret = com_readRowsByEntry(pg, 1, 1);
    //Read last day from Profile Generic.
    time_now(&startTime);
    endTime = startTime;
    time_clearTime(&startTime);
    ret = com_readRowsByRange(pg, &startTime, &endTime);
  }
  //Do not clear objects list because it will free also objects from association view list.
  oa_empty(&objects);
  return ret;
}

// This function reads ALL objects that meter have excluded profile generic objects.
// It will loop all object's attributes.
int com_readValues() {
  gxByteBuffer attributes;
  unsigned char ch;
  char* data = NULL;
  gxObject* object;
  unsigned long index;
  int ret, pos;
  BYTE_BUFFER_INIT(&attributes);

  for (pos = 0; pos != Client.GetObjects()->size; ++pos) {
    ret = oa_getByIndex(Client.GetObjects(), pos, &object);
    if (ret != DLMS_ERROR_CODE_OK) {
      bb_clear(&attributes);
      return ret;
    }
    ///////////////////////////////////////////////////////////////////////////////////
    // Profile generics are read later because they are special cases.
    // (There might be so lots of data and we so not want waste time to read all the data.)
    if (object->objectType == DLMS_OBJECT_TYPE_PROFILE_GENERIC) {
      continue;
    }
    ret = obj_getAttributeIndexToRead(object, &attributes);
    if (ret != DLMS_ERROR_CODE_OK) {
      bb_clear(&attributes);
      return ret;
    }
    for (index = 0; index < attributes.size; ++index) {
      ret = bb_getUInt8ByIndex(&attributes, index, &ch);
      if (ret != DLMS_ERROR_CODE_OK) {
        bb_clear(&attributes);
        return ret;
      }
      ret = com_read(object, ch);
      if (ret != DLMS_ERROR_CODE_OK) {
        //Return error if not DLMS error.
        if (ret != DLMS_ERROR_CODE_READ_WRITE_DENIED) {
          bb_clear(&attributes);
          return ret;
        }
        ret = 0;
      }
    }
    bb_clear(&attributes);
  }
  bb_clear(&attributes);
  return ret;
}

void print_dlmsVARIANT(dlmsVARIANT data) {
  Serial.print("Data Type (vt): ");
  Serial.println(data.vt);

  Serial.print("bVal: ");
  Serial.println(data.bVal);

  Serial.print("cVal: ");
  Serial.println(data.cVal);

  Serial.print("iVal: ");
  Serial.println(data.iVal);

  Serial.print("lVal: ");
  Serial.println(data.lVal);

  Serial.print("llVal: ");
  //Serial.println(data.llVal);

#ifndef DLMS_IGNORE_FLOAT32
  Serial.print("fltVal: ");
  Serial.println(data.fltVal);
#endif  //DLMS_IGNORE_FLOAT32

#ifndef DLMS_IGNORE_FLOAT64
  Serial.print("dblVal: ");
  Serial.println(data.dblVal);
#endif  //DLMS_IGNORE_FLOAT64

  Serial.print("boolVal: ");
  Serial.println(data.boolVal);

  Serial.print("uiVal: ");
  Serial.println(data.uiVal);

  Serial.print("ulVal: ");
  Serial.println(data.ulVal);

  // Serial.print("ullVal: ");
  //Serial.println(data.ullVal);

#ifndef DLMS_IGNORE_MALLOC
// Printing gxtime, gxByteBuffer, bitArray, variantArray, byteArr, etc. if needed.
#endif  //DLMS_IGNORE_MALLOC

  Serial.println();
}

//This function reads ALL objects that meter have. It will loop all object's attributes.
int com_readAllObjects(const char* invocationCounter) {
  int ret;

  ret = com_initializeConnection();
  if (ret != DLMS_ERROR_CODE_OK) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_initializeConnection failed"), ret);
    return ret;
  }
  GXTRACE_INT(GET_STR_FROM_EEPROM("com_initializeConnection SUCCEEDED"), ret);

  char* data = NULL;

  gxRegister bv;
  cosem_init(BASE(bv), DLMS_OBJECT_TYPE_REGISTER, "1.0.32.7.0.255");
  com_read(BASE(bv), 2);
  obj_toString(BASE(bv), &data);

  Serial.print("[~] Voltage : ");
  Serial.print(bv.value.iVal * 0.1);
  Serial.print("v");

  //Current
  gxRegister Current;
  cosem_init(BASE(Current), DLMS_OBJECT_TYPE_REGISTER, "1.0.31.7.0.255");
  com_read(BASE(Current), 2);
  obj_toString(BASE(Current), &data);

  Serial.print("[~]Current : ");
  Serial.print(Current.value.iVal * 0.001);
  Serial.print("A");

  //Active Power
  gxRegister P;
  cosem_init(BASE(P), DLMS_OBJECT_TYPE_REGISTER, "1.0.1.8.1.255");
  com_read(BASE(P), 2);
  obj_toString(BASE(P), &data);

  Serial.print("[~]Active Power : ");
  Serial.print(P.value.iVal * 0.1);
  Serial.print("W");

  Client.ReleaseObjects();

  //sendHTTPRequest(bv.value.iVal * 0.1, Current.value.iVal * 0.001);
  delay(5000);

  return ret;
}

void handleRelay(int mode) {
  char* data = NULL;
  gxDisconnectControl rc;
  dlmsVARIANT rc_params;
  var_init(&rc_params);
  var_setInt8(&rc_params, 0);
  cosem_init(BASE(rc), DLMS_OBJECT_TYPE_DISCONNECT_CONTROL, "0.0.96.3.10.255");
  com_method(BASE(rc), mode, &rc_params);
  com_read(BASE(rc), 3);
  char* reconnect_data;
  obj_toString(BASE(rc), &reconnect_data);
  GXTRACE(PSTR("Reconnected : "), reconnect_data);
  obj_clear(BASE(rc));
  free(reconnect_data);
}

void setup() {

  Serial.begin(2400);
  Serial2.begin(2400);

  connectToWiFi();

  server.on("/relay", HTTP_GET, [](AsyncWebServerRequest* request) {
    // Check if the "paramName" parameter exists in the request
    if (request->hasParam("mode")) {
      // Retrieve the value of the "mode" parameter
      String mode = request->getParam("mode")->value();

      // Compare the parameter value with a specific condition
      if (mode == "on") {
        // Do something if the condition is met
        request->send(200, "text/html", "<html><body><h1>Connected!</h1></body></html>");
        handleRelay(CONNECT);
      } else {
        // Do something else if the condition is not met
        request->send(200, "text/html", "<html><body><h1>Disconnected!</h1></body></html>");
        handleRelay(DISCONNECT);  // For example, handle the relay differently
      }
    } else {
      // Handle the case where the "mode" parameter is not present
      request->send(200, "text/html", "<html><body><h1>Command sent, no parameter found!</h1></body></html>");
    }
  });

  server.begin();

  BYTE_BUFFER_INIT(&frameData);
  bb_capacity(&frameData, 128);
  const char* myPassword = "11111111";

  Client.init(true, 4, 1, DLMS_AUTHENTICATION_LOW, myPassword, DLMS_INTERFACE_TYPE_HDLC);

  int ret = com_initializeConnection();
  if (ret != DLMS_ERROR_CODE_OK) {
    GXTRACE_INT(GET_STR_FROM_EEPROM("com_initializeConnection failed"), ret);
  }
  GXTRACE_INT(GET_STR_FROM_EEPROM("com_initializeConnection SUCCEEDED"), ret);
}

unsigned long lastHttpRequestTime = 0;  // Initialize a variable to keep track of the last HTTP request time

void loop() {
  int ret;
  if (millis() - runTime > 5000) {
    runTime = millis();
    GXTRACE(GET_STR_FROM_EEPROM("Start reading"), NULL);

    char* data = NULL;

    //Meter ID
    gxData ldn;
    cosem_init(BASE(ldn), DLMS_OBJECT_TYPE_DATA, "0.0.96.1.1.255");
    com_read(BASE(ldn), 2);
    obj_toString(BASE(ldn), &data);
    Serial.print("[~] Device ID : ");
    Serial.print(ldn.value.iVal);
    
    //Voltage
    gxRegister bv;
    cosem_init(BASE(bv), DLMS_OBJECT_TYPE_REGISTER, "1.0.32.7.0.255");
    com_read(BASE(bv), 2);
    obj_toString(BASE(bv), &data);

    Serial.print("[~] Voltage : ");
    Serial.print(bv.value.iVal * 0.1);
    Serial.print("v");

    // Current
    gxRegister Current;
    cosem_init(BASE(Current), DLMS_OBJECT_TYPE_REGISTER, "1.0.31.7.0.255");
    com_read(BASE(Current), 2);
    obj_toString(BASE(Current), &data);

    Serial.print("[~]Current : ");
    Serial.print(Current.value.iVal * 0.001);
    Serial.print("A");

    // Active Power
    gxRegister P;
    cosem_init(BASE(P), DLMS_OBJECT_TYPE_REGISTER, "1.0.15.8.1.1");
    com_read(BASE(P), 2);
    obj_toString(BASE(P), &data);

    Serial.print("[~]_ ");
    Serial.print(P.value.iVal * 0.1);
    Serial.print("kWh");

    if (millis() - lastHttpRequestTime >= 10000) {
      String meterIDValue = "MyMeter1";

      sendHTTPRequest(bv.value.iVal * 0.1, Current.value.iVal * 0.001, P.value.iVal * 0.1, meterIDValue);
      lastHttpRequestTime = millis();
    }

    if (Current.value.iVal * 0.001 > 3 && millis() - lastHttpRequestTime >= 10000) {
      sendImmediateHTTPRequest();
      lastHttpRequestTime = millis();
    }
  }
}
