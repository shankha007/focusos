import { useRef, useState } from 'react';
import { Check, Copy, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/primitives';
import { CREATOR } from './content';

/**
 * `mailto:` is capped well below what a browser URL can hold — several clients
 * (and Windows' shell handler in particular) silently truncate or refuse a long
 * one. Keeping the whole URL under this leaves room for the encoded subject and
 * headers on top of the message itself.
 */
const MAX_MESSAGE = 1400;

interface Errors {
  name?: string;
  email?: string;
  message?: string;
}

/** Deliberately permissive: something@something.tld. Anything stricter rejects
 *  addresses that are perfectly valid, and the real check is whether the reply
 *  arrives. */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function buildBody(name: string, email: string, message: string): string {
  return `${message.trim()}\n\n—\nFrom: ${name.trim()}\nReply to: ${email.trim()}\nSent from focusos.pro`;
}

/**
 * Feedback form that hands off to the visitor's own mail client. Nothing is
 * posted anywhere — the app has no backend, and quietly shipping one just for a
 * contact form would break the promise the rest of the page makes about data
 * never leaving the device.
 *
 * `mailto:` fails silently when no mail client is registered, which is common
 * on desktop, so the compose step always leaves a copyable fallback behind
 * rather than assuming it worked.
 */
export function FeedbackForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [handedOff, setHandedOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_MESSAGE - message.length;

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Please add your name.';
    if (!email.trim()) next.email = 'Please add your email so a reply can reach you.';
    else if (!isEmail(email)) next.email = 'That does not look like an email address.';
    if (!message.trim()) next.message = 'Please write a little about what you think.';
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    // Move focus to the first problem so keyboard and screen-reader users are
    // taken to it rather than having to hunt for the red text.
    if (found.name) return nameRef.current?.focus();
    if (found.email) return emailRef.current?.focus();
    if (found.message) return messageRef.current?.focus();

    const subject = `FocusOS feedback from ${name.trim()}`;
    const url = `mailto:${CREATOR.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(buildBody(name, email, message))}`;

    window.location.href = url;
    setHandedOff(true);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(buildBody(name, email, message));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access is blocked in some contexts. The message is still on
      // screen and selectable, so there is nothing useful to recover to.
      setCopied(false);
    }
  }

  return (
    <div className="panel overflow-hidden p-0">
      <div className="lit border-b border-border px-6 py-5 sm:px-8">
        <h3 className="text-lg font-semibold tracking-tight">Tell me what you think</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Bugs, feature ideas, or just whether it helped. This opens your own email app with the
          message ready — nothing is sent from this page, and nothing is stored.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="fb-name" error={errors.name}>
            <Input
              id="fb-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'fb-name-error' : undefined}
            />
          </Field>

          <Field label="Email" htmlFor="fb-email" error={errors.email}>
            <Input
              id="fb-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'fb-email-error' : undefined}
            />
          </Field>
        </div>

        <Field label="Feedback" htmlFor="fb-message" error={errors.message}>
          <Textarea
            id="fb-message"
            ref={messageRef}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What worked, what did not, what you wish it did…"
            className="min-h-[132px]"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'fb-message-error' : 'fb-message-count'}
          />
          <p
            id="fb-message-count"
            className={remaining < 140 ? 'text-[11px] text-warn' : 'text-[11px] text-subtle'}
          >
            {remaining} characters left
          </p>
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" size="lg" className="gap-2">
            <Send className="h-4 w-4" />
            Send feedback
          </Button>
          <span className="text-[12px] text-subtle">Opens your email app</span>
        </div>

        {handedOff && (
          <div
            role="status"
            className="animate-fade-in rounded-xl border border-border bg-elevated px-4 py-3"
          >
            <p className="text-[13px] font-medium text-fg">Your email app should be opening.</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Nothing happened? Some browsers have no mail app registered. Copy the message and send
              it to{' '}
              <a
                href={`mailto:${CREATOR.email}`}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {CREATOR.email}
              </a>{' '}
              yourself.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 gap-2"
              onClick={copyMessage}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy message'}
            </Button>
          </div>
        )}

        <p className="flex items-center gap-1.5 pt-1 text-[12px] text-subtle">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          Or write directly to{' '}
          <a
            href={`mailto:${CREATOR.email}`}
            className="font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
          >
            {CREATOR.email}
          </a>
        </p>
      </form>
    </div>
  );
}

/** Label, control, and the error line that replaces the helper text when set. */
function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
