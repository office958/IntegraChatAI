'use client';

import { useState } from 'react';
import SettingsSidebar from '@/components/SettingsSidebar';
import GeneralSettings from '@/components/GeneralSettings';
import AccountSettings from '@/components/AccountSettings';
import styles from './Settings.module.css';

type SettingsSection = 'general' | 'personalization' | 'account';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  return (
    <div className={styles.settingsContainer}>
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className={styles.settingsContent}>
        {activeSection === 'general' && <GeneralSettings />}
        {activeSection === 'personalization' && (
          <div className={styles.placeholderSection}>
            <h2>Personalizare</h2>
            <p>Secțiunea de personalizare va fi disponibilă în curând.</p>
          </div>
        )}
        {activeSection === 'account' && <AccountSettings />}
      </div>
    </div>
  );
}

