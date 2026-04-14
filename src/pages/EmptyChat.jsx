import { MessageSquare } from 'lucide-react';

export default function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
      <MessageSquare size={64} strokeWidth={1} />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">EchoChat</h2>
        <p className="text-sm">Seleccioná una conversación o creá una nueva</p>
      </div>
    </div>
  );
}
