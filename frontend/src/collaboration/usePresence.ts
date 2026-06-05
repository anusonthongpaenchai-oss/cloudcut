import { useEffect, useState, useCallback, useRef } from "react";
import { getPusherInstance } from "./usePusher.js";
import type { PresenceChannel, Members } from "pusher-js";

export interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
}

export interface CursorPosition {
  userId: string;
  name: string;
  currentTimeMs: number;
  activeTrackId?: string;
  activeClipId?: string;
}

export interface PusherMember {
  id: string;
  info?: {
    name?: string;
    avatar?: string;
  };
}

export const usePresence = (projectId: string) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPosition>>({});
  const channelRef = useRef<PresenceChannel | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const pusher = getPusherInstance();
    const channelName = `presence-project-${projectId}`;
    const channel = pusher.subscribe(channelName) as PresenceChannel;
    channelRef.current = channel;

    const updateCollaborators = (members: Members) => {
      const list: Collaborator[] = [];
      members.each((member: PusherMember) => {
        list.push({
          id: member.id,
          name: member.info?.name || "Unknown",
          avatar: member.info?.avatar,
          isActive: true,
        });
      });
      setCollaborators(list);
    };

    channel.bind("pusher:subscription_succeeded", (members: Members) => {
      updateCollaborators(members);
    });

    channel.bind("pusher:member_added", (member: PusherMember) => {
      setCollaborators((prev) => {
        // Prevent duplicates
        if (prev.find((c) => c.id === member.id)) return prev;
        return [
          ...prev,
          { id: member.id, name: member.info?.name || "Unknown", avatar: member.info?.avatar, isActive: true },
        ];
      });
    });

    channel.bind("pusher:member_removed", (member: PusherMember) => {
      setCollaborators((prev) => prev.filter((c) => c.id !== member.id));
      setRemoteCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[member.id];
        return newCursors;
      });
    });

    channel.bind("client-cursor-move", (data: CursorPosition) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: data,
      }));
    });

    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [projectId]);

  // Throttle cursor-move to 100ms
  const lastSendTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendCursorMove = useCallback((data: CursorPosition) => {
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTimeRef.current;

    const triggerEvent = () => {
      if (channelRef.current && channelRef.current.subscribed) {
        channelRef.current.trigger("client-cursor-move", data);
      }
      lastSendTimeRef.current = Date.now();
    };

    if (timeSinceLastSend >= 100) {
      triggerEvent();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Set a trailing edge timeout to ensure the final position is sent
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(triggerEvent, 100 - timeSinceLastSend);
    }
  }, []);

  return { collaborators, remoteCursors, sendCursorMove };
};
