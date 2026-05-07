import { getSupabaseConfigError, publicAnonKey, projectId } from "/utils/supabase/info";

type Unsubscribe = () => void;

interface KvChangePayload {
  data?: {
    record?: { key?: string };
    old_record?: { key?: string };
  };
}

export function subscribeToKvPrefixes(prefixes: string[], onChange: () => void): Unsubscribe {
  const configError = getSupabaseConfigError();
  if (configError || !projectId) return () => undefined;

  let closed = false;
  let socket: WebSocket | null = null;
  let heartbeatId: number | undefined;
  let reconnectId: number | undefined;
  let ref = 1;

  const nextRef = () => String(ref++);

  const send = (event: string, payload: object, topic = "realtime:public:kv_store_fd08abf5") => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic, event, payload, ref: nextRef() }));
  };

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(`wss://${projectId}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(publicAnonKey)}&vsn=1.0.0`);

    socket.onopen = () => {
      send("phx_join", {
        config: {
          postgres_changes: [
            { event: "*", schema: "public", table: "kv_store_fd08abf5" }
          ]
        }
      });
      heartbeatId = window.setInterval(() => send("heartbeat", {}, "phoenix"), 25_000);
    };

    socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { event?: string; payload?: KvChangePayload };
        if (payload.event !== "postgres_changes") return;

        const key = payload.payload?.data?.record?.key || payload.payload?.data?.old_record?.key || "";
        if (!key || prefixes.some((prefix) => key.startsWith(prefix))) onChange();
      } catch {
        // Realtime is progressive enhancement; API polling remains the safe fallback.
      }
    };

    socket.onclose = () => {
      if (heartbeatId) window.clearInterval(heartbeatId);
      if (!closed) reconnectId = window.setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    closed = true;
    if (heartbeatId) window.clearInterval(heartbeatId);
    if (reconnectId) window.clearTimeout(reconnectId);
    socket?.close();
  };
}
