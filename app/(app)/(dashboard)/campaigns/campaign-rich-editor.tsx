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
      className={`rounded-md px-2 py-1 text-xs font-medium border transition-colors disabled:opacity-40 ${
        active
          ? "border-accent bg-accent/15 text-foreground"
          : "border-border bg-background hover:bg-white/10 text-foreground"
      }`}
    >
      {children}
    </button>
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
      <div className="rounded-lg border border-border bg-white min-h-[280px] flex items-center justify-center text-sm text-zinc-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="campaign-rich-editor space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Upload image for campaign email"
        onChange={onFile}
      />

      <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border">
        <span className="text-[10px] uppercase tracking-wide text-muted w-full mb-0.5">Format</span>
        <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </ToolbarBtn>
        <ToolbarBtn
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarBtn>
        <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </ToolbarBtn>
        <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </ToolbarBtn>
        <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </ToolbarBtn>
        <ToolbarBtn title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          ←
        </ToolbarBtn>
        <ToolbarBtn title="Align centre" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          C
        </ToolbarBtn>
        <ToolbarBtn title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          →
        </ToolbarBtn>
        <ToolbarBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          HR
        </ToolbarBtn>
        <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={() => setLink(editor)}>
          Link
        </ToolbarBtn>
        <ToolbarBtn title="Insert image" disabled={uploading} onClick={pickImage}>
          {uploading ? "…" : "Image"}
        </ToolbarBtn>
        <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          Undo
        </ToolbarBtn>
        <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          Redo
        </ToolbarBtn>
      </div>

      <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border">
        <span className="text-[10px] uppercase tracking-wide text-muted w-full mb-0.5">Layout blocks</span>
        <ToolbarBtn title="Centered headline + subtext" onClick={() => insertSnippet(editor, LAYOUT_SNIPPETS.hero)}>
          Hero
        </ToolbarBtn>
        <ToolbarBtn title="Centered green button (edit URL + text)" onClick={() => insertSnippet(editor, LAYOUT_SNIPPETS.cta)}>
          CTA button
        </ToolbarBtn>
        <ToolbarBtn title="Spacer + divider" onClick={() => insertSnippet(editor, LAYOUT_SNIPPETS.divider)}>
          Divider
        </ToolbarBtn>
        <ToolbarBtn title="Two-column row (email-safe table)" onClick={() => insertSnippet(editor, LAYOUT_SNIPPETS.twoCol)}>
          2 columns
        </ToolbarBtn>
      </div>

      {uploadErr && <p className="text-xs text-red-400">{uploadErr}</p>}

      <div className="rounded-lg border border-border bg-white shadow-inner overflow-hidden">
        <EditorContent editor={editor} />
      </div>
      <p className="text-[11px] text-muted">
        Images upload to your salon folder and load in inboxes via a public link. For best results use JPEG or PNG
        under ~1&nbsp;MB.
      </p>
    </div>
  );
}
