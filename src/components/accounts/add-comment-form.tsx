"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/server/actions/accounts";

export function AddCommentForm({ accountId }: { accountId: string }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        await addComment(accountId, trimmed);
        setBody("");
        toast.success("Opmerking toegevoegd");
        textareaRef.current?.focus();
      } catch {
        toast.error("Opmerking toevoegen mislukt");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Opmerking toevoegen…"
        disabled={isPending}
        className="min-h-20"
      />
      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={isPending || body.trim().length === 0}
      >
        {isPending ? "Bezig…" : "Toevoegen"}
      </Button>
    </form>
  );
}
