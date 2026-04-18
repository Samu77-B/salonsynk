"use client";

import { useCallback, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadCampaignImageAction } from "./actions";
import "./campaign-editor.css";

const LAYOUT_SNIPPETS = {
  hero: `<h2 style="text-align:center;margin:16px 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#111827;">Your headline</h2><p style="text-align:center;margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.5;">A short supporting line for your clients.</p>`,
  cta: `<p style="text-align:center;margin:24px 0;"><a href="https://" style="display:inline-block;padding:12px 28px;background-color:#15803d;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Book now</a></p>`,
  divider: `<p style="margin:16px 0;">&nbsp;</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" /><p style="margin:16px 0;">&nbsp;</p>`,
  twoCol: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:16px auto;border-collapse:collapse;"><tr><td width="50%" valign="top" style="padding:8px;vertical-align:top;"><p style="margin:0;color:#374151;font-size:14px;">Left column — offer or image.</p></td><td width="50%" valign="top" style="padding:8px;vertical-align:top;"><p style="margin:0;color:#374151;font-size:14px;">Right column — details or CTA.</p></td></tr></table>`,
};

type LayoutBlockId = keyof typeof LAYOUT_SNIPPETS;

/** Miniature wireframe shown on each layout block card (matches email styling, not interactive). */
function LayoutBlockVisual({ variant }: { variant: LayoutBlockId }) {
  const canvas = "relative min-h-[112px] overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200/80 dark:bg-zinc-950/60 dark:ring-zinc-700/80";

  switch (variant) {
    case "hero":
      return (
        <div className={canvas} aria-hidden>
          <div className="flex h-full min-h-[112px] flex-col items-center justify-center gap-2.5 px-6 py-5">
            <div className="h-2.5 w-[72%] max-w-[160px] rounded-md bg-zinc-500/90" />
            <div className="h-1.5 w-[88%] max-w-[180px] rounded bg-zinc-400/70" />
            <div className="h-1.5 w-[64%] max-w-[130px] rounded bg-zinc-400/70" />
          </div>
        </div>
      );
    case "cta":
      return (
        <div className={canvas} aria-hidden>
          <div className="flex min-h-[112px] items-center justify-center px-4 py-6">
            <span className="rounded-lg bg-emerald-700 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-white shadow-md ring-1 ring-emerald-900/20 dark:bg-emerald-600">
              Book now
            </span>
          </div>
        </div>
      );
    case "divider":
      return (
        <div className={canvas} aria-hidden>
          <div className="flex min-h-[112px] flex-col justify-center gap-4 px-5 py-4">
            <div className="h-2 rounded-sm bg-white shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-900 dark:ring-zinc-700" />
            <div className="h-px w-full bg-zinc-300 dark:bg-zinc-600" />
            <div className="h-2 rounded-sm bg-white shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-900 dark:ring-zinc-700" />
          </div>
        </div>
      );
    case "twoCol":
      return (
        <div className={canvas} aria-hidden>
          <div className="grid min-h-[112px] grid-cols-2 gap-2 p-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/90 bg-white p-2.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
              <div className="h-2 w-full rounded bg-zinc-400/80" />
              <div className="h-1.5 w-[85%] rounded bg-zinc-300/90" />
              <div className="h-1.5 w-[60%] rounded bg-zinc-300/90" />
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/90 bg-white p-2.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
              <div className="h-2 w-full rounded bg-zinc-400/80" />
              <div className="h-1.5 w-[90%] rounded bg-zinc-300/90" />
              <div className="h-1.5 w-[55%] rounded bg-zinc-300/90" />
            </div>
          </div>
        </div>
      );
  }
}

const LAYOUT_BLOCKS: {
  id: LayoutBlockId;
  title: string;
  description: string;
  insertTitle: string;
}[] = [
  {
    id: "hero",
    title: "Hero",
    description: "Centred headline and supporting line — good for openings.",
    insertTitle: "Insert hero section",
  },
  {
    id: "cta",
    title: "CTA button",
    description: "Centre-aligned button — edit the link and label after inserting.",
    insertTitle: "Insert CTA button block",
  },
  {
    id: "divider",
    title: "Divider",
    description: "Breathing room plus a horizontal rule between sections.",
    insertTitle: "Insert divider",
  },
  {
    id: "twoCol",
    title: "Two columns",
    description: "Side-by-side text (email-safe table) for offers and details.",
    insertTitle: "Insert two-column layout",
  },
];

function ToolbarBtn({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        active
          ? "border-accent bg-accent/20 text-foreground shadow-sm"
          : "border-transparent bg-white/80 text-zinc-700 hover:bg-white hover:border-border dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarCluster({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/90 px-2 py-1.5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/50"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function insertSnippet(editor: Editor | null, html: string) {
  if (!editor) return;
  editor.chain().focus().insertContent(html).run();
}

function setLink(editor: Editor | null) {
  if (!editor) return;
  const { empty } = editor.state.selection;
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previous ?? "https://");
  if (url === null) return;
  const trimmed = url.trim();
  if (trimmed === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const safeHref = trimmed.replace(/"/g, "&quot;");
  if (empty) {
    editor.chain().focus().insertContent(`<a href="${safeHref}">Link text</a>`).run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
}

export function CampaignRichEditor({
  salonId,
  initialHtml,
  onHtmlChange,
}: {
  salonId: string;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        horizontalRule: { HTMLAttributes: { style: "margin:20px 0;border:none;border-top:1px solid #e5e7eb" } },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { style: "color:#15803d;text-decoration:underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          style: "max-width:100%;height:auto;display:block;margin:12px auto;border-radius:8px",
        },
      }),
      Placeholder.configure({
        placeholder: "Write your campaign… Use the toolbar or Layout blocks for a polished email.",
      }),
    ],
    content: initialHtml?.trim() ? initialHtml : "<p></p>",
    editorProps: {
      attributes: {
        class: "campaign-tiptap",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML());
    },
  });

  const pickImage = useCallback(() => {
    setUploadErr(null);
    fileRef.current?.click();
  }, []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !editor) return;
      setUploading(true);
      setUploadErr(null);
      const fd = new FormData();
      fd.set("image", file);
      const r = await uploadCampaignImageAction(salonId, fd);
      setUploading(false);
      if (r.error) {
        setUploadErr(r.error);
        return;
      }
      if (r.url) {
        editor.chain().focus().setImage({ src: r.url }).run();
      }
    },
    [editor, salonId]
  );

  if (!editor) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 min-h-[320px] flex items-center justify-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="campaign-rich-editor space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Upload image for campaign email"
        onChange={onFile}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Formatting</p>
            <p className="text-[11px] text-muted mt-0.5 max-w-xl hidden sm:block">
              Style text, then add structure with layout blocks — they insert ready-made sections you can edit.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start">
          <ToolbarCluster label="Text style">
            <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
              <strong className="font-bold">B</strong>
            </ToolbarBtn>
            <ToolbarBtn
              title="Italic"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em className="italic">I</em>
            </ToolbarBtn>
            <ToolbarBtn
              title="Underline"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <span className="underline">U</span>
            </ToolbarBtn>
            <ToolbarBtn
              title="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </ToolbarBtn>
            <ToolbarBtn
              title="Heading 3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              H3
            </ToolbarBtn>
          </ToolbarCluster>

          <ToolbarCluster label="Lists and alignment">
            <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <span className="text-xs">• List</span>
            </ToolbarBtn>
            <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <span className="text-xs">1. List</span>
            </ToolbarBtn>
            <ToolbarBtn title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
              <span className="text-xs font-semibold">Left</span>
            </ToolbarBtn>
            <ToolbarBtn title="Align centre" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
              <span className="text-xs font-semibold">Centre</span>
            </ToolbarBtn>
            <ToolbarBtn title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
              <span className="text-xs font-semibold">Right</span>
            </ToolbarBtn>
          </ToolbarCluster>

          <ToolbarCluster label="Insert and history">
            <ToolbarBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <span className="text-xs">Rule</span>
            </ToolbarBtn>
            <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={() => setLink(editor)}>
              Link
            </ToolbarBtn>
            <ToolbarBtn title="Insert image" disabled={uploading} onClick={pickImage}>
              {uploading ? "…" : "Image"}
            </ToolbarBtn>
            <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
              <span className="text-xs">Undo</span>
            </ToolbarBtn>
            <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
              <span className="text-xs">Redo</span>
            </ToolbarBtn>
          </ToolbarCluster>
        </div>

        <div>
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Layout blocks</p>
            <p className="text-[11px] text-muted mt-1 max-w-2xl">
              Click a block to insert it at the cursor. The preview shows roughly how it will look in the email.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LAYOUT_BLOCKS.map((block) => (
              <button
                key={block.id}
                type="button"
                title={block.insertTitle}
                onClick={() => insertSnippet(editor, LAYOUT_SNIPPETS[block.id])}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-white/95 text-left shadow-sm ring-0 transition-all hover:border-accent/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 dark:bg-zinc-900/55"
              >
                <div className="border-b border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <LayoutBlockVisual variant={block.id} />
                </div>
                <div className="space-y-1 px-4 py-3.5">
                  <span className="block text-base font-semibold text-foreground group-hover:text-accent transition-colors">
                    {block.title}
                  </span>
                  <span className="block text-sm text-muted leading-snug">{block.description}</span>
                  <span className="block pt-2 text-xs font-medium text-accent/90">Click to insert at cursor</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {uploadErr && <p className="text-xs text-red-400">{uploadErr}</p>}

      <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-black/5 overflow-hidden dark:border-zinc-700 dark:bg-zinc-950 dark:ring-white/5">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/90 px-3 py-2 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
          Email preview area
        </div>
        <EditorContent editor={editor} />
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Images are stored for your salon and shown via a public URL. Use JPEG or PNG under about 1&nbsp;MB for reliable
        loading.
      </p>
    </div>
  );
}
