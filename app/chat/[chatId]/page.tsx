import ChatContainer from '@/components/ChatContainer';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContainer />
    </ProtectedRoute>
  );
}

