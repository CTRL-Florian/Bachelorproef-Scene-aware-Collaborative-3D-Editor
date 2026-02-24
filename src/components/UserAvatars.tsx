import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAwareness } from '@/stores/useAwarenessStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Get initials from name (max 2 characters)
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const UserAvatars: React.FC = () => {
  const { users, currentUser } = useAwareness();

  if (users.length === 0) {
    return null;
  }

  // Sort users so current user is first, then alphabetically
  const sortedUsers = [...users].sort((a, b) => {
    if (currentUser && a.name === currentUser.name) return -1;
    if (currentUser && b.name === currentUser.name) return 1;
    return a.name.localeCompare(b.name);
  });

  // Show max 5 avatars, rest as count
  const visibleUsers = sortedUsers.slice(0, 5);
  const hiddenCount = sortedUsers.length - 5;

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user) => (
        <Popover key={user.clientId}>
          <PopoverTrigger asChild>
            <button className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full">
              <Avatar 
                className="border-2 border-white cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                style={{ backgroundColor: user.color }}
              >
                <AvatarFallback 
                  className="text-white text-xs font-medium"
                  style={{ backgroundColor: user.color }}
                >
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="bottom">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: user.color }}
              />
              <span className="text-sm font-medium">{user.name}</span>
              {currentUser && user.name === currentUser.name && (
                <span className="text-xs text-gray-500">(jij)</span>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ))}
      
      {hiddenCount > 0 && (
        <Avatar className="border-2 border-white bg-gray-400">
          <AvatarFallback className="text-white text-xs font-medium bg-gray-400">
            +{hiddenCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default UserAvatars;
