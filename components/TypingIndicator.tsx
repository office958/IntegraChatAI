import styles from './TypingIndicator.module.css';

export default function TypingIndicator() {
  return (
    <div className={styles.typingIndicator}>
      <div className={styles.typingDots}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

