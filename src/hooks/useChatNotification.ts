import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useChatNotification() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/notification.wav');
      audioRef.current.preload = 'auto';
    }
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    if (!isEnabled || !audioRef.current) return;

    try {
      // Reset audio to beginning and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.warn('Failed to play notification sound:', error);
      });
    } catch (error) {
      console.warn('Error playing notification:', error);
    }
  };

  // Set up real-time listener for incoming messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-notification-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          // Play sound only for new messages from others (not our own)
          if (payload.new.sender_id !== user.id) {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isEnabled]);

  return {
    playNotificationSound,
    isEnabled,
    setIsEnabled,
  };
}
