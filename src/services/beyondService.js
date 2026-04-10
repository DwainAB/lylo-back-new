'use strict';

/**
 * Beyond Presence — démarre un agent avatar dans une room LiveKit.
 * Doc : https://docs.bey.dev/api-reference/calls/create-call
 */

const BEY_API_URL = 'https://api.bey.dev/v1/calls';

/**
 * Démarre l'agent Beyond.
 * @param {object} params
 * @param {string} params.agentId  — BEY_AGENT_FEMALE ou BEY_AGENT_MALE
 * @returns {Promise<{callId: string, livekitUrl: string, livekitToken: string}>}
 */
async function startAvatarCall({ agentId }) {
  const apiKey = process.env.BEY_API_KEY;
  if (!apiKey) throw new Error('BEY_API_KEY manquant');

  const res = await fetch(BEY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ agent_id: agentId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Beyond] start failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  console.log(`[Beyond] call started → id=${data.id}`);
  return {
    callId: data.id,
    livekitUrl: data.livekit?.server_url,
    livekitToken: data.livekit?.token,
  };
}

module.exports = { startAvatarCall };
