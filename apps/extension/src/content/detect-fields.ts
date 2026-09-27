import type { DetectedControlType, DetectedField, DetectedFieldOption } from "@application-copilot/shared";

export function scanApplicationPage(): DetectedField[] {
  function cleanText(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
  }

  function humanize(value: string): string {
    return cleanText(
      value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_.\-[\]]+/g, " ")
    );
  }

  function isVisible(control: Element): boolean {
    if (control.closest('[hidden], [aria-hidden="true"]')) return false;

    let current: Element | null = control;
    while (current) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      current = current.parentElement;
    }

    return true;
  }

  function referencedText(control: Element): string {
    const ids = control.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
    return cleanText(ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
  }

  function explicitLabel(control: Element): string {
    const id = (control as HTMLInputElement).id;
    if (!id) return "";
    const label = Array.from(document.querySelectorAll("label")).find((candidate) => candidate.htmlFor === id);
    return cleanText(label?.textContent);
  }

  function wrappedLabel(control: Element): string {
    return cleanText(control.closest("label")?.textContent);
  }

  function groupLabel(control: Element): string {
    const fieldset = control.closest("fieldset");
    return cleanText(fieldset?.querySelector(":scope > legend")?.textContent);
  }

  function individualLabel(control: Element): string {
    return (
      referencedText(control) ||
      explicitLabel(control) ||
      wrappedLabel(control) ||
      cleanText(control.getAttribute("aria-label")) ||
      cleanText(control.getAttribute("placeholder"))
    );
  }

  function fieldLabel(control: Element, inputType: string): string {
    const grouped = inputType === "radio" ? groupLabel(control) : "";
    return (
      grouped ||
      referencedText(control) ||
      explicitLabel(control) ||
      wrappedLabel(control) ||
      cleanText(control.getAttribute("aria-label")) ||
      cleanText(control.getAttribute("placeholder")) ||
      humanize(control.getAttribute("name") ?? "") ||
      humanize((control as HTMLElement).id)
    );
  }

  function controlType(control: Element): DetectedControlType {
    const tag = control.tagName.toLowerCase();
    if (tag === "select") return "select";
    if (tag === "textarea") return "textarea";

    const type = ((control as HTMLInputElement).type || "text").toLowerCase();
    const known: DetectedControlType[] = [
      "text", "email", "tel", "url", "number", "date", "checkbox", "radio", "file", "password"
    ];
    return known.includes(type as DetectedControlType) ? (type as DetectedControlType) : "other";
  }

  function selectOptions(control: HTMLSelectElement): DetectedFieldOption[] {
    return Array.from(control.options)
      .filter((option) => option.value || cleanText(option.textContent))
      .map((option) => ({ value: option.value, label: cleanText(option.textContent) }));
  }

  const controls = Array.from(document.querySelectorAll("input, select, textarea"));
  const fields: DetectedField[] = [];
  const seenRadioGroups = new Set<string>();

  controls.forEach((control, index) => {
    const input = control as HTMLInputElement;
    const type = controlType(control);
    if (input.disabled || input.type === "hidden" || !isVisible(control)) return;

    const name = cleanText(control.getAttribute("name"));
    let options: DetectedFieldOption[] = [];

    if (type === "radio") {
      const groupKey = name || input.id || `radio-${index}`;
      if (seenRadioGroups.has(groupKey)) return;
      seenRadioGroups.add(groupKey);

      const group = controls.filter(
        (candidate) =>
          candidate.tagName.toLowerCase() === "input" &&
          (candidate as HTMLInputElement).type === "radio" &&
          ((candidate.getAttribute("name") || candidate.id || `radio-${index}`) === groupKey)
      );
      options = group.map((candidate) => ({
        value: (candidate as HTMLInputElement).value,
        label: individualLabel(candidate) || (candidate as HTMLInputElement).value
      }));
    } else if (type === "select") {
      options = selectOptions(control as HTMLSelectElement);
    }

    fields.push({
      fieldId: `${input.id || name || type}-${index}`,
      label: fieldLabel(control, type) || `Unlabeled ${type} field`,
      controlType: type,
      name,
      required: input.required || control.getAttribute("aria-required") === "true",
      options,
      locator: {
        id: input.id,
        name,
        domIndex: index
      }
    });
  });

  return fields;
}
