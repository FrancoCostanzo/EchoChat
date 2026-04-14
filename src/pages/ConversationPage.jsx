import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, Dropdown, Label, Spinner } from '@heroui/react';
import {
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Search,
  Pin,
  Smile,
  Reply,
  Pencil,
  Trash2,
  Hash,
  ArrowDown,
  Download,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import { formatMessageTime, formatFullTime } from '@/lib/dates';
import { storageApi } from '@/lib/endpoints';

function downloadBlob(url, filename) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'file';
      a.click();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => window.open(url, '_blank'));
}

function AttachmentView({ attachment }) {
  const [url, setUrl] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isImage =
    attachment.object_type === 'image' || attachment.mime_type?.startsWith('image/');

  useEffect(() => {
    storageApi.getUrl(attachment.id).then((res) => setUrl(res.data.url)).catch(() => {});
  }, [attachment.id]);

  if (!url) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-default ${
          isImage ? 'h-32 w-48' : 'h-8 w-40'
        }`}
      />
    );
  }

  if (isImage) {
    return (
      <>
        <div
          className="group relative inline-block cursor-zoom-in"
          onClick={() => setViewerOpen(true)}
        >
          <img
            src={url}
            alt={attachment.original_filename}
            className="max-h-64 max-w-xs rounded-lg object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1 rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); downloadBlob(url, attachment.original_filename); }}
              className="pointer-events-auto rounded bg-black/60 p-1 text-white hover:bg-black/80"
              title="Descargar"
            >
              <Download size={13} />
            </button>
          </div>
        </div>
        {viewerOpen && (
          <ImageViewer
            src={url}
            filename={attachment.original_filename}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-separator px-3 py-2 text-xs hover:bg-default-hover"
    >
      <Paperclip size={14} />
      <span className="max-w-45 truncate">{attachment.original_filename}</span>
    </a>
  );
}

function MessageBubble({ message, isOwn, onEdit, onDelete, onReply, onReact }) {
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className={`group flex gap-2 px-4 py-1 ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {!isOwn && (
        <UserAvatar
          user={{ display_name: message.sender_display_name }}
          size="sm"
          className="mt-1 shrink-0"
        />
      )}

      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && (
          <span className="mb-0.5 text-xs font-medium text-accent">{message.sender_display_name}</span>
        )}

        {message.reply_to_id && message.reply_to_body && (
          <div className="mb-1 rounded-md border-l-2 border-accent bg-default px-2 py-1 text-xs text-muted">
            {message.reply_to_body}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isOwn
              ? 'rounded-tr-sm bg-accent text-accent-foreground'
              : 'rounded-tl-sm bg-default text-foreground'
          }`}
        >
          {message.type !== 'media' && (
            <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p>
          )}
          {message.attachments?.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {message.attachments.map((att) => (
                <AttachmentView key={att.id} attachment={att} />
              ))}
            </div>
          )}
          <div
            className={`mt-1 flex items-center gap-1 text-[10px] ${
              isOwn ? 'text-accent-foreground/70 justify-end' : 'text-muted'
            }`}
          >
            {message.is_edited && <span>(editado)</span>}
            <span>{formatMessageTime(message.sent_at)}</span>
          </div>
        </div>

        {message.reactions?.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {message.reactions.map((r, i) => (
              <button
                key={i}
                onClick={() => onReact(message.id, r.emoji)}
                className="rounded-full bg-default px-1.5 py-0.5 text-xs hover:bg-default-hover"
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {hovering && (
        <div className="flex items-start gap-0.5 self-center">
          <Button isIconOnly size="sm" variant="ghost" onPress={() => onReply(message)}>
            <Reply size={14} />
          </Button>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => onReact(message.id, '👍')}>
            <Smile size={14} />
          </Button>
          {isOwn && (
            <>
              <Button isIconOnly size="sm" variant="ghost" onPress={() => onEdit(message)}>
                <Pencil size={14} />
              </Button>
              <Button isIconOnly size="sm" variant="danger" onPress={() => onDelete(message.id)}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams();
  const user = useAuthStore((s) => s.user);
  const {
    messages,
    loadingMessages,
    hasMoreMessages,
    setActiveConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    loadMoreMessages,
    getActiveConversation,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const conversation = getActiveConversation();

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!atBottom);
    if (el.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadMoreMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    const body = input.trim();
    if (!body) return;

    if (editing) {
      await editMessage(editing.id, body);
      setEditing(null);
    } else {
      const data = {
        conversation_id: conversationId,
        body,
        type: 'text',
      };
      if (replyTo) {
        data.reply_to_id = replyTo.id;
      }
      await sendMessage(data);
      setReplyTo(null);
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const objectType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'document';

      const { data: storageObj } = await storageApi.upload(file, objectType);

      await sendMessage({
        conversation_id: conversationId,
        body: file.name,
        type: 'media',
        attachment_ids: [storageObj.id],
      });
    } catch (err) {
      console.error('Upload failed:', err);
    }
    e.target.value = '';
  };

  const handleEdit = (msg) => {
    setEditing(msg);
    setInput(msg.body);
    setReplyTo(null);
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    setEditing(null);
  };

  const handleDelete = async (msgId) => {
    await deleteMessage(msgId);
  };

  const handleReact = async (msgId, emoji) => {
    await addReaction(msgId, emoji);
  };

  const cancelAction = () => {
    setReplyTo(null);
    setEditing(null);
    setInput('');
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const convName = conversation.display_name || conversation.name || 'Conversación';
  const isDirect = conversation.type === 'direct';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <div className="flex items-center gap-3">
          {isDirect ? (
            <UserAvatar
              user={{ display_name: convName, presence: conversation.member_presence }}
              showStatus
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
              <Hash size={18} className="text-accent" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold">{convName}</h2>
            {isDirect && conversation.member_presence && (
              <p className="text-xs text-muted capitalize">{conversation.member_presence}</p>
            )}
            {!isDirect && conversation.member_count && (
              <p className="text-xs text-muted">{conversation.member_count} miembros</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button isIconOnly size="sm" variant="ghost">
            <Phone size={18} />
          </Button>
          <Button isIconOnly size="sm" variant="ghost">
            <Video size={18} />
          </Button>
          <Button isIconOnly size="sm" variant="ghost">
            <Search size={18} />
          </Button>
          <Dropdown>
            <Button isIconOnly size="sm" variant="ghost">
              <MoreVertical size={18} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item id="pinned" textValue="Mensajes fijados">
                  <Pin size={16} />
                  <Label>Mensajes fijados</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto py-4"
      >
        {loadingMessages && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {hasMoreMessages && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <Button
              size="sm"
              variant="ghost"
              isDisabled={loadingMessages}
              onPress={loadMoreMessages}
            >
              {loadingMessages ? <Spinner size="sm" /> : 'Cargar mensajes anteriores'}
            </Button>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === user?.id}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReply={handleReply}
            onReact={handleReact}
          />
        ))}
        <div ref={messagesEndRef} />

        {showScrollBtn && (
          <Button
            isIconOnly
            size="sm"
            className="absolute bottom-4 right-4 shadow-lg"
            onPress={scrollToBottom}
          >
            <ArrowDown size={16} />
          </Button>
        )}
      </div>

      {/* Reply / Edit indicator */}
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-t border-separator bg-background-secondary px-4 py-2">
          <div className="flex-1">
            <p className="text-xs font-medium text-accent">
              {editing ? 'Editando mensaje' : `Respondiendo a ${replyTo.sender_display_name}`}
            </p>
            <p className="truncate text-xs text-muted">
              {editing ? editing.body : replyTo.body}
            </p>
          </div>
          <Button size="sm" variant="ghost" onPress={cancelAction}>
            ✕
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-separator px-4 py-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </Button>

          <Input
            placeholder="Escribí un mensaje..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-default"
          />

          <Button
            isIconOnly
            size="sm"
            onPress={handleSend}
            isDisabled={!input.trim()}
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
