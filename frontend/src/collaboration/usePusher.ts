import Pusher from "pusher-js";

let pusherInstance: Pusher | null = null;

export const getPusherInstance = () => {
  if (!pusherInstance) {
    const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || "app-key";
    const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || "ap1";
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    pusherInstance = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: `${API_URL}/pusher/auth`,
      auth: {
        headers: {
          // Send JWT token from local or session storage to verify in backend
          Authorization: `Bearer ${localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken")}`,
        },
      },
    });
  }
  return pusherInstance;
};

export const subscribeToChannel = (channelName: string) => {
  const pusher = getPusherInstance();
  return pusher.subscribe(channelName);
};

export const unsubscribeFromChannel = (channelName: string) => {
  const pusher = getPusherInstance();
  pusher.unsubscribe(channelName);
};
