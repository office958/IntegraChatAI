import ChatContainer from '@/components/ChatContainer';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ChatSessionPage() {
  return (
    <ProtectedRoute>
      <ChatContainer />
    </ProtectedRoute>
  );
}

