'use client';

import { useEffect } from 'react';
import UserAccountMenu from './UserAccountMenu';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  title: string;
  subtitle: string;
  color?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  onDeleteAccount?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function ChatHeader({ 
  title, 
  subtitle, 
  color, 
  userName,
  userEmail,
  userRole,
  onDeleteAccount,
  onToggleSidebar,
  sidebarOpen,
}: ChatHeaderProps) {
  useEffect(() => {
    if (color) {
      // Aplică culoarea dinamică
      const root = document.documentElement;
      root.style.setProperty('--primary-color', color);
      
      // Calculează variantele de culoare
      const rgb = hexToRgb(color);
      if (rgb) {
        const darken = (r: number, g: number, b: number, percent: number) => {
          const factor = 1 - percent / 100;
          return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
        };
        const lighten = (r: number, g: number, b: number, percent: number) => {
          const factor = percent / 100;
          return `rgb(${Math.min(255, Math.round(r + (255 - r) * factor))}, ${Math.min(255, Math.round(g + (255 - g) * factor))}, ${Math.min(255, Math.round(b + (255 - b) * factor))})`;
        };
        
        root.style.setProperty('--primary-color-dark', darken(rgb.r, rgb.g, rgb.b, 15));
        root.style.setProperty('--primary-color-light', lighten(rgb.r, rgb.g, rgb.b, 15));
      }
    }
  }, [color]);

  return (
    <div className={styles.chatHeaderTop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className={styles.chatHeaderInfo}>
          <h1 className={styles.chatTitle}>{title}</h1>
          <p className={styles.chatSubtitle}>{subtitle}</p>
        </div>
      </div>
      <UserAccountMenu 
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

