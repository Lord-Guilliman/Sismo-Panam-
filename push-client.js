/* Sismo Panamá v0.7.1 — cliente Web Push opcional.
 * No se activa sin PUSH_API_BASE. Nunca contiene claves privadas ni credenciales.
 */
(() => {
  'use strict';
  const config = window.SISMO_CONFIG || {};
  const base = String(config.PUSH_API_BASE || '').trim().replace(/\/$/, '');
  const byId = (id) => document.getElementById(id);
  const enableButton = byId('pushEnableBtn');
  const disableButton = byId('pushDisableBtn');
  const status = byId('pushStatus');
  const minMag = byId('pushMinMag');
  if (!enableButton || !disableButton || !status || !minMag) return;

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }
  function appSupportsPush() {
    return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function url(path) { return `${base}${path}`; }
  function base64UrlToBytes(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(normalized);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }
  async function api(path, options = {}) {
    const response = await fetch(url(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).detail || ''; } catch (_) {}
      throw new Error(detail || `El servidor respondió HTTP ${response.status}`);
    }
    return response.json();
  }
  async function syncState() {
    if (!base) {
      enableButton.disabled = true;
      disableButton.hidden = true;
      setStatus('No configurado: falta desplegar el backend Web Push y añadir su URL en config.js. El resto de la PWA puede funcionar, pero no habrá avisos remotos con la app cerrada.', 'pending');
      return;
    }
    if (!appSupportsPush()) {
      enableButton.disabled = true;
      setStatus('Este navegador/contexto no admite Web Push. Usa un navegador compatible y abre la aplicación desde HTTPS.', 'warning');
      return;
    }
    enableButton.disabled = false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      enableButton.textContent = subscription ? 'Actualizar preferencia de notificaciones' : 'Activar notificaciones remotas';
      disableButton.hidden = !subscription;
      setStatus(subscription ? 'Este dispositivo tiene una suscripción Web Push. La entrega depende del backend, del proveedor push, de la conexión y de los permisos del sistema.' : 'El backend está configurado. Activa las notificaciones si aceptas recibir avisos de eventos sísmicos publicados por USGS.', subscription ? 'ok' : '');
    } catch (error) {
      setStatus(`No se pudo consultar el estado de notificaciones: ${error.message}`, 'warning');
    }
  }

  enableButton.addEventListener('click', async () => {
    if (!base) return;
    enableButton.disabled = true;
    setStatus('Preparando la suscripción…');
    try {
      if (Notification.permission === 'denied') throw new Error('Bloqueaste las notificaciones para este sitio. Cámbialo desde los permisos del navegador.');
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('No se concedió el permiso de notificaciones.');
      const registration = await navigator.serviceWorker.ready;
      const keyData = await api('/api/push/public-key', { method: 'GET', headers: {} });
      if (!keyData.publicKey) throw new Error('El servidor no tiene una clave pública Web Push configurada.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(keyData.publicKey) });
      await api('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON(), minMagnitude: Number(minMag.value) }),
      });
      setStatus('Suscripción registrada. Esto no garantiza aviso antes del movimiento; el servidor solo notifica después de recibir un reporte de la fuente.', 'ok');
      disableButton.hidden = false;
      enableButton.textContent = 'Actualizar preferencia de notificaciones';
    } catch (error) {
      setStatus(`No se pudo activar Web Push: ${error.message}`, 'warning');
    } finally {
      enableButton.disabled = false;
    }
  });

  disableButton.addEventListener('click', async () => {
    if (!base) return;
    disableButton.disabled = true;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setStatus('Notificaciones remotas desactivadas en este dispositivo.');
      await syncState();
    } catch (error) {
      setStatus(`No se pudo desactivar la suscripción: ${error.message}`, 'warning');
    } finally {
      disableButton.disabled = false;
    }
  });

  document.addEventListener('DOMContentLoaded', syncState);
  if (document.readyState !== 'loading') syncState();
})();
