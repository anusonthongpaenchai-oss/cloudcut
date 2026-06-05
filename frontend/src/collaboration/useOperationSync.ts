import { useEffect, useRef } from "react";
import { getPusherInstance } from "./usePusher.js";
import api from "../services/api.js";

// Note: we'll use an empty toast function if the shadcn hook isn't fully ready yet,
// but the architecture is prepared for it.
import { useToast } from "../components/ui/use-toast.js";

// Placeholder import for projectStore logic
import { useProjectStore } from "../state/projectStore.js"; 

export interface OperationPayload {
  operationId: string;
  type: string;
  projectId: string;
  userId: string;
  serverSeq: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectStoreState {
  applyOperation?: (op: unknown) => void;
  reloadFullState?: (projectId: string) => Promise<void>;
}

export const useOperationSync = (projectId: string, currentUserId: string) => {
  // Use toast hook (assuming shadcn/ui is or will be installed here)
  let toast: (options: { title: string; description: string }) => void;
  try {
    const toastHook = useToast();
    toast = toastHook.toast;
  } catch (e) {
    // Fallback if not properly installed yet
    toast = console.log;
  }

  // Assuming useProjectStore exposes these actions.
  // We use optional chaining later in case the store isn't fully implemented yet.
  const applyOperation = useProjectStore((state: ProjectStoreState) => state.applyOperation);
  const reloadFullState = useProjectStore((state: ProjectStoreState) => state.reloadFullState);
  
  const lastSeenServerSeq = useRef<number>(0);

  useEffect(() => {
    if (!projectId || !currentUserId) return;

    const pusher = getPusherInstance();
    const channelName = `private-project-${projectId}`;
    const channel = pusher.subscribe(channelName);

    const fetchMissedOperations = async () => {
      try {
        const { data } = await api.get(`/projects/${projectId}/operations`, {
          params: { afterSeq: lastSeenServerSeq.current }
        });

        if (data.tooLarge) {
          if (reloadFullState) {
            await reloadFullState(projectId);
          } else {
            // Fallback reload
            window.location.reload();
          }
        } else if (data.operations && data.operations.length > 0) {
          for (const op of data.operations) {
            if (applyOperation) {
              applyOperation(op);
            }
            lastSeenServerSeq.current = Math.max(lastSeenServerSeq.current, op.server_seq);
          }
        }
      } catch (error) {
        console.error("Failed to fetch missed operations:", error);
      }
    };

    // Listen to Pusher reconnect event
    pusher.connection.bind("connected", () => {
      // Only fetch if we've already seen some sequences, implying this is a reconnect
      if (lastSeenServerSeq.current > 0) {
        fetchMissedOperations();
      }
    });

    interface OperationEventData {
      server_seq?: number;
      serverSeq?: number;
      userId?: string;
      user_id?: string;
      [key: string]: unknown;
    }

    const handleOperationEvent = (eventName: string, data: OperationEventData) => {
       const serverSeq = data.server_seq || data.serverSeq;
       if (serverSeq) {
         lastSeenServerSeq.current = Math.max(lastSeenServerSeq.current, serverSeq);
       }

       // We check who caused the event. The structure might vary based on your backend response.
       // E.g., data.userId, or data.clip?.updated_by
       const eventUserId = data.userId || data.user_id;

       if (eventUserId && eventUserId !== currentUserId) {
         if (applyOperation) {
           applyOperation({ type: eventName, ...data });
         }
         
         toast({
           title: "Timeline Updated",
           description: "Another collaborator updated this clip. Your local change was synced with the server version.",
         });
       }
    };

    const events = [
      "clip-updated", 
      "track-updated", 
      "effect-updated", 
      "transition-updated",
      "text-overlay-updated"
    ];

    events.forEach(ev => channel.bind(ev, (data: OperationEventData) => handleOperationEvent(ev, data)));

    return () => {
      events.forEach(ev => channel.unbind(ev));
      pusher.unsubscribe(channelName);
      pusher.connection.unbind("connected");
    };
  }, [projectId, currentUserId, applyOperation, reloadFullState, toast]);

};
