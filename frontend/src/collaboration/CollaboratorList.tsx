import React from "react";
import type { Collaborator } from "./usePresence.js";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip.js";

interface CollaboratorListProps {
  collaborators: Collaborator[];
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({ collaborators }) => {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  // Generate consistent colors for fallback avatars based on user ID
  const getColorForUser = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 40%)`;
  };

  return (
    <div className="flex items-center space-x-2 px-4 py-2">
      <div className="flex -space-x-2 overflow-hidden">
        <TooltipProvider>
          {collaborators.map((collaborator) => {
            const fallbackColor = getColorForUser(collaborator.id);
            const initials = collaborator.name.substring(0, 2).toUpperCase();

            return (
              <Tooltip key={collaborator.id}>
                <TooltipTrigger asChild>
                  <div className="relative inline-block h-8 w-8 rounded-full border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110">
                    <Avatar className="h-full w-full">
                      {collaborator.avatar && <AvatarImage src={collaborator.avatar} alt={collaborator.name} />}
                      <AvatarFallback style={{ backgroundColor: fallbackColor, color: "white" }} className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Active Status Badge */}
                    {collaborator.isActive && (
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-background" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{collaborator.name} (Online)</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
      
      {/* Optional: Show count if too many users */}
      {collaborators.length > 5 && (
        <span className="text-xs text-muted-foreground ml-2">
          +{collaborators.length - 5}
        </span>
      )}
    </div>
  );
};
