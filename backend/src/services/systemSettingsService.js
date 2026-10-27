function getPool() {
  if (!process.env.DATABASE_URL) return null;
  return require('../config/db').pool;
}

// In-memory cache of system settings for fast synchronous and asynchronous access
let settingsCache = {};
let isInitialized = false;

const DEFAULT_DEFINITIONS = {
  // AI & Chatbot LLM
  GROQ_API_KEY: {
    category: 'api_keys',
    description: 'Groq API Key for LLM reasoning and energy assistant',
    isSecret: true,
    envVar: 'GROQ_KEY'
  },
  GROQ_MODEL: {
    category: 'api_keys',
    description: 'Groq Inference Model Identifier',
    isSecret: false,
    default: 'llama-3.3-70b-versatile',
    envVar: 'GROQ_MODEL'
  },

  // Text.lk SMS Gateway
  SMS_API_TOKEN: {
    category: 'api_keys',
    description: 'Text.lk API v3 Bearer Token',
    isSecret: true,
    envVar: 'SMS_API_TOKEN'
  },
  SMS_SENDER_ID: {
    category: 'api_keys',
    description: 'Text.lk Approved Sender Mask',
    isSecret: false,
    default: 'TextLKDemo',
    envVar: 'SMS_SENDER_ID'
  },

  // PayHere Payment Gateway
  PAYHERE_MERCHANT_ID: {
    category: 'api_keys',
    description: 'PayHere Merchant Account ID',
    isSecret: false,
    envVar: 'PAYHERE_MERCHANT_ID'
  },
  PAYHERE_MERCHANT_SECRET: {
    category: 'api_keys',
    description: 'PayHere Merchant Secret Salt for MD5 Signature Hashing',
    isSecret: true,
    envVar: 'PAYHERE_MERCHANT_SECRET'
  },
  PAYHERE_SANDBOX: {
    category: 'api_keys',
    description: 'PayHere Sandbox Mode (true for testing, false for production)',
    isSecret: false,
    default: 'true',
    envVar: 'PAYHERE_SANDBOX'
  },

  // Customer Dashboard Feature Toggles
  feature_ai_chatbot: {
    category: 'features',
    description: 'Enable or disable the AI Energy Assistant Bot in Customer Portal',
    isSecret: false,
    default: 'true'
  },
  feature_online_topup: {
    category: 'features',
    description: 'Enable or disable PayHere online recharge in Customer Portal',
    isSecret: false,
    default: 'true'
  },
  feature_ml_prediction: {
    category: 'features',
    description: 'Enable or disable ML Energy Forecast and Days-Remaining estimations',
    isSecret: false,
    default: 'true'
  },
  feature_lifeline_mode: {
    category: 'features',
    description: 'Enable or disable Customer Lifeline emergency credit buffer toggle',
    isSecret: false,
    default: 'true'
  },
  feature_complaints_portal: {
    category: 'features',
    description: 'Enable or disable customer complaint and outage lodging tickets',
    isSecret: false,
    default: 'true'
  },
  feature_solar_telemetry: {
    category: 'features',
    description: 'Enable or disable Rooftop Solar Net Metering charts and analytics',
    isSecret: false,
    default: 'true'
  },
  maintenance_mode: {
    category: 'features',
    description: 'Global maintenance mode indicator across customer portal',
    isSecret: false,
    default: 'false'
  },
  maintenance_banner: {
    category: 'features',
    description: 'Custom message broadcast to all active customer sessions',
    isSecret: false,
    default: ''
  }
};

/**
 * Initializes table and loads active settings into in-memory cache
 */
async function initializeSystemSettings() {
  try {
    const pool = getPool();
    if (!pool) {
      isInitialized = true;
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        description TEXT,
        is_secret BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const res = await pool.query('SELECT key, value FROM system_settings');
    const loaded = {};
    for (const row of res.rows) {
      loaded[row.key] = row.value;
    }

    settingsCache = loaded;
    isInitialized = true;
    console.log(`[SystemSettings] Loaded ${res.rows.length} dynamic settings from database.`);
  } catch (err) {
    console.warn('[SystemSettings] Notice: Database settings init skipped (fallback to env):', err.message);
    isInitialized = true;
  }
}

/**
 * Retrieves a setting value:
 * 1. Checks in-memory cache / DB
 * 2. Checks associated environment variable
 * 3. Falls back to default definition or fallback param
 */
function getSettingSync(key, fallback = '') {
  if (settingsCache[key] !== undefined && settingsCache[key] !== null && settingsCache[key] !== '') {
    return settingsCache[key];
  }

  const def = DEFAULT_DEFINITIONS[key];
  if (def && def.envVar && process.env[def.envVar]) {
    return process.env[def.envVar];
  }

  if (def && def.default !== undefined) {
    return def.default;
  }

  return fallback;
}

/**
 * Asynchronous getter
 */
async function getSetting(key, fallback = '') {
  if (!isInitialized) {
    await initializeSystemSettings();
  }
  return getSettingSync(key, fallback);
}

/**
 * Helper to get boolean feature flag
 */
function isFeatureEnabledSync(featureKey, defaultVal = true) {
  const val = getSettingSync(featureKey, defaultVal ? 'true' : 'false');
  return val === 'true' || val === true || val === '1';
}

/**
 * Returns masked settings dictionary for Staff Portal display
 */
async function getAllSettingsForStaff() {
  if (!isInitialized) {
    await initializeSystemSettings();
  }

  const result = {
    apiKeys: {},
    features: {}
  };

  for (const [key, def] of Object.entries(DEFAULT_DEFINITIONS)) {
    const rawVal = getSettingSync(key, '');
    const hasDbVal = Boolean(settingsCache[key]);
    const hasEnvVal = Boolean(def.envVar && process.env[def.envVar]);

    let displayVal = rawVal;
    if (def.isSecret && rawVal) {
      if (rawVal.length > 6) {
        displayVal = rawVal.slice(0, 4) + '••••••••••••' + rawVal.slice(-3);
      } else {
        displayVal = '••••••••';
      }
    }

    const payload = {
      key,
      value: displayVal,
      hasValue: Boolean(rawVal),
      isConfigured: Boolean(rawVal),
      source: hasDbVal ? 'database' : hasEnvVal ? 'environment' : 'default',
      description: def.description,
      isSecret: Boolean(def.isSecret)
    };

    if (def.category === 'features') {
      payload.enabled = rawVal === 'true' || rawVal === true;
      result.features[key] = payload;
    } else {
      result.apiKeys[key] = payload;
    }
  }

  return result;
}

/**
 * Updates settings in PostgreSQL and updates cache immediately
 */
async function updateSettings(settingsMap, staffEmail = 'staff') {
  if (!isInitialized) {
    await initializeSystemSettings();
  }

  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not configured for updating system settings.');
  }

  const updatedKeys = [];

  for (const [key, value] of Object.entries(settingsMap)) {
    if (value === undefined || value === null) continue;
    const strVal = String(value).trim();
    const def = DEFAULT_DEFINITIONS[key];

    // If secret is masked or untouched, do not overwrite with masked string
    if (def && def.isSecret && strVal.includes('••••')) {
      continue;
    }

    const category = def ? def.category : 'general';
    const description = def ? def.description : '';
    const isSecret = def ? def.isSecret : false;

    await pool.query(
      `INSERT INTO system_settings (key, value, category, description, is_secret, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, strVal, category, description, isSecret]
    );

    settingsCache[key] = strVal;
    updatedKeys.push(key);
  }

  console.log(`[SystemSettings] Staff (${staffEmail}) updated settings: ${updatedKeys.join(', ')}`);
  return { success: true, updatedKeys };
}

/**
 * Public Feature Flags for Customer Portal
 */
function getPublicFeatureFlags() {
  return {
    aiChatbot: isFeatureEnabledSync('feature_ai_chatbot', true),
    onlineTopup: isFeatureEnabledSync('feature_online_topup', true),
    mlPrediction: isFeatureEnabledSync('feature_ml_prediction', true),
    lifelineMode: isFeatureEnabledSync('feature_lifeline_mode', true),
    complaintsPortal: isFeatureEnabledSync('feature_complaints_portal', true),
    solarTelemetry: isFeatureEnabledSync('feature_solar_telemetry', true),
    maintenanceMode: isFeatureEnabledSync('maintenance_mode', false),
    maintenanceBanner: getSettingSync('maintenance_banner', '')
  };
}

module.exports = {
  initializeSystemSettings,
  getSetting,
  getSettingSync,
  isFeatureEnabledSync,
  getAllSettingsForStaff,
  updateSettings,
  getPublicFeatureFlags
};
