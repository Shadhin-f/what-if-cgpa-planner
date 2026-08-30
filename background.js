'use strict';

// GA4 Measurement Protocol integration.
// The API secret only allows *sending* events to this property — it does not
// grant read access to GA data, which is why it's safe to ship in the extension.
const MEASUREMENT_ID = 'G-3E0X9YS64L';
const API_SECRET = 'PI9SM2RYQgGfGH6JizQObA';
const SESSION_EXPIRATION_MS = 30 * 60 * 1000;

async function getOrCreateClientId() {
  const { client_id } = await chrome.storage.local.get('client_id');
  if (client_id) return client_id;
  const newClientId = `${Math.round(Math.random() * 1e10)}.${Date.now()}`;
  await chrome.storage.local.set({ client_id: newClientId });
  return newClientId;
}

async function getOrCreateSessionId() {
  const now = Date.now();
  let { session_data } = await chrome.storage.session.get('session_data');
  if (session_data && now - session_data.timestamp < SESSION_EXPIRATION_MS) {
    session_data.timestamp = now;
    await chrome.storage.session.set({ session_data });
    return session_data.session_id;
  }
  session_data = { session_id: String(now), timestamp: now };
  await chrome.storage.session.set({ session_data });
  return session_data.session_id;
}

async function fireEvent(name, params) {
  try {
    const [client_id, session_id] = await Promise.all([getOrCreateClientId(), getOrCreateSessionId()]);
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id,
        events: [{
          name,
          params: { session_id, engagement_time_msec: '100', ...params }
        }]
      })
    });
  } catch (e) {
    // Analytics must never break the extension.
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'gpap_analytics_event') {
    fireEvent(message.name, message.params || {});
  }
});

self.addEventListener('unhandledrejection', (event) => {
  fireEvent('extension_error', { message: String(event.reason).slice(0, 100), source: 'background' });
});
