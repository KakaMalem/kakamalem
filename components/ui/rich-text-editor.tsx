"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Code2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================================================
// Types
// ============================================================================

export interface RichTextEditorProps {
  /** Current HTML content */
  value?: string;
  /** Called when content changes (returns HTML string) */
  onChange?: (html: string) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Disable the editor */
  disabled?: boolean;
  /** Optional character limit */
  characterLimit?: number;
  /** Show character count */
  showCharacterCount?: boolean;
  /** Additional class names for the container */
  className?: string;
  /** Minimum height for the editor */
  minHeight?: string;
  /** ID for accessibility */
  id?: string;
  /** aria-invalid for form validation */
  "aria-invalid"?: boolean;
}

// ============================================================================
// Toolbar Button Component
// ============================================================================

interface ToolbarButtonProps {
  pressed?: boolean;
  onPressedChange?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

function ToolbarButton({
  pressed,
  onPressedChange,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="size-8 p-0 data-[state=on]:bg-accent"
    >
      {children}
    </Toggle>
  );
}

// ============================================================================
// Link Popover Component
// ============================================================================

interface LinkPopoverProps {
  editor: Editor;
  disabled?: boolean;
}

function LinkPopover({ editor, disabled }: LinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const isActive = editor.isActive("link");

  const handleSetLink = useCallback(() => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      // Ensure URL has protocol
      const finalUrl =
        url.startsWith("http://") || url.startsWith("https://")
          ? url
          : `https://${url}`;

      editor.chain().focus().setLink({ href: finalUrl }).run();
    }
    setOpen(false);
    setUrl("");
  }, [editor, url]);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Pre-fill with existing link URL if editing
        const previousUrl = editor.getAttributes("link").href || "";
        setUrl(previousUrl);
      }
      setOpen(isOpen);
    },
    [editor]
  );

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          pressed={isActive}
          disabled={disabled}
          aria-label="Add link"
          title="Add link"
          className="size-8 p-0 data-[state=on]:bg-accent"
        >
          <LinkIcon className="size-4" />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSetLink();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            {isActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
              >
                <Unlink className="mr-1.5 size-3.5" />
                Remove
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleSetLink}>
              {isActive ? "Update" : "Add"} Link
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Toolbar Component
// ============================================================================

interface ToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  isSourceMode?: boolean;
  onToggleSource?: () => void;
}

function Toolbar({
  editor,
  disabled,
  isSourceMode,
  onToggleSource,
}: ToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
      {/* Headings */}
      {(
        [
          [1, Heading1],
          [2, Heading2],
          [3, Heading3],
          [4, Heading4],
          [5, Heading5],
          [6, Heading6],
        ] as const
      ).map(([level, Icon]) => (
        <ToolbarButton
          key={level}
          pressed={editor.isActive("heading", { level })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level }).run()
          }
          disabled={disabled}
          title={`Heading ${level}`}
        >
          <Icon className="size-4" />
        </ToolbarButton>
      ))}

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text formatting */}
      <ToolbarButton
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled}
        title="Bold (Ctrl+B)"
      >
        <Bold className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled}
        title="Italic (Ctrl+I)"
      >
        <Italic className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        disabled={disabled}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        disabled={disabled}
        title="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <ToolbarButton
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        disabled={disabled}
        title="Bullet list"
      >
        <List className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
        title="Numbered list"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text alignment */}
      <ToolbarButton
        pressed={editor.isActive({ textAlign: "left" })}
        onPressedChange={() =>
          editor.chain().focus().setTextAlign("left").run()
        }
        disabled={disabled}
        title="Align left"
      >
        <AlignLeft className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive({ textAlign: "center" })}
        onPressedChange={() =>
          editor.chain().focus().setTextAlign("center").run()
        }
        disabled={disabled}
        title="Align center"
      >
        <AlignCenter className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        pressed={editor.isActive({ textAlign: "right" })}
        onPressedChange={() =>
          editor.chain().focus().setTextAlign("right").run()
        }
        disabled={disabled}
        title="Align right"
      >
        <AlignRight className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Links */}
      <LinkPopover editor={editor} disabled={disabled} />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Clear formatting */}
      <ToolbarButton
        onPressedChange={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
        disabled={disabled}
        title="Clear formatting"
      >
        <RemoveFormatting className="size-4" />
      </ToolbarButton>

      <div className="flex-1" />

      {/* Undo/Redo */}
      <ToolbarButton
        onPressedChange={() => editor.chain().focus().undo().run()}
        disabled={disabled || !editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        onPressedChange={() => editor.chain().focus().redo().run()}
        disabled={disabled || !editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* HTML source toggle */}
      {onToggleSource && (
        <ToolbarButton
          pressed={isSourceMode || false}
          onPressedChange={onToggleSource}
          disabled={disabled}
          title="Toggle HTML source"
        >
          <Code2 className="size-4" />
        </ToolbarButton>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Start typing...",
  disabled = false,
  characterLimit,
  showCharacterCount = false,
  className,
  minHeight = "150px",
  id,
  "aria-invalid": ariaInvalid,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        // Lists are included by default in StarterKit
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground before:absolute before:pointer-events-none before:left-0 before:top-0",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
      ...(characterLimit
        ? [CharacterCount.configure({ limit: characterLimit })]
        : [CharacterCount]),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "rich-text-editor-content focus:outline-none",
        style: `min-height: ${minHeight}`,
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Return empty string if content is just empty paragraph
      const isEmpty = html === "<p></p>" || html === "";
      onChange?.(isEmpty ? "" : html);
    },
    // Prevent SSR hydration issues
    immediatelyRender: false,
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Only update if the external value is different
      const currentHtml = editor.getHTML();
      const normalizedValue = value || "";
      const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml;

      if (normalizedValue !== normalizedCurrent) {
        editor.commands.setContent(value || "");
      }
    }
  }, [editor, value]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const characterCount = editor?.storage.characterCount?.characters() ?? 0;
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");

  const handleToggleSource = useCallback(() => {
    if (!editor) return;
    if (isSourceMode) {
      // Switching back to rich text — apply the edited HTML
      editor.commands.setContent(sourceHtml);
      onChange?.(sourceHtml || "");
    } else {
      // Switching to source — grab current HTML
      setSourceHtml(editor.getHTML());
    }
    setIsSourceMode(!isSourceMode);
  }, [editor, isSourceMode, sourceHtml, onChange]);

  return (
    <div
      className={cn(
        "rounded-md border bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        ariaInvalid && "border-destructive",
        className
      )}
    >
      <Toolbar
        editor={editor}
        disabled={disabled}
        isSourceMode={isSourceMode}
        onToggleSource={handleToggleSource}
      />

      {isSourceMode ? (
        /* HTML source editor */
        <div className="p-3">
          <textarea
            value={sourceHtml}
            onChange={(e) => setSourceHtml(e.target.value)}
            disabled={disabled}
            className="w-full min-h-37.5 font-mono text-xs bg-zinc-50 border border-zinc-200 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            style={{ minHeight: minHeight }}
            spellCheck={false}
          />
        </div>
      ) : (
        /* Rich text editor */
        <div className="p-3 rich-text-editor-wrapper">
          <EditorContent editor={editor} />
        </div>
      )}

      {showCharacterCount && (
        <div className="flex justify-end border-t px-3 py-1.5 text-xs text-muted-foreground">
          {characterLimit ? (
            <span
              className={cn(
                characterCount > characterLimit * 0.9 && "text-amber-600",
                characterCount >= characterLimit && "text-destructive"
              )}
            >
              {characterCount} / {characterLimit}
            </span>
          ) : (
            <span>{characterCount} characters</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utilities - Re-exported from lib/utils/html for convenience
// ============================================================================

export { stripHtml, isHtmlEmpty } from "@/lib/utils/html";
