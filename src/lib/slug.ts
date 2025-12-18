import { supabase } from "@/integrations/supabase/client";

const slugifyValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
};

export const generateUniqueProposalSlug = async (
  ...candidates: (string | null | undefined)[]
) => {
  const baseInput =
    candidates
      .map((value) => value?.trim())
      .find((value) => value && value.length > 0) ?? `propuesta-${Date.now()}`;

  const baseSlug = slugifyValue(baseInput) || `propuesta-${Date.now()}`;

  let attempt = 0;
  let candidate = baseSlug;

  while (attempt < 20) {
    const { count, error } = await supabase
      .from("proposals")
      .select("id", { head: true, count: "exact" })
      .eq("public_url_slug", candidate);

    if (error) {
      console.error("Error verifying slug uniqueness:", error);
      throw error;
    }

    if (!count) {
      return candidate;
    }

    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }

  return `${baseSlug}-${Date.now()}`;
};




























