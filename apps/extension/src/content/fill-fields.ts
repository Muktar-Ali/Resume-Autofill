import type {
  FieldFillInstruction,
  FieldFillResult
} from "@application-copilot/shared";

export function fillApplicationFields(instructions: FieldFillInstruction[]): FieldFillResult[] {
  const controls = Array.from(document.querySelectorAll("input, select, textarea"));

  function normalize(value: string | null | undefined): string {
    return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function findControl(instruction: FieldFillInstruction): Element | null {
    if (instruction.locator.id) {
      const byId = controls.find((control) => (control as HTMLElement).id === instruction.locator.id);
      if (byId) return byId;
    }

    const byIndex = controls[instruction.locator.domIndex];
    if (
      byIndex &&
      (!instruction.locator.name || byIndex.getAttribute("name") === instruction.locator.name)
    ) {
      return byIndex;
    }

    if (instruction.locator.name) {
      return controls.find((control) => control.getAttribute("name") === instruction.locator.name) ?? null;
    }

    return null;
  }

  function dispatchChanges(control: Element) {
    const EventConstructor = control.ownerDocument.defaultView?.Event;
    if (!EventConstructor) return;
    control.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    control.dispatchEvent(new EventConstructor("change", { bubbles: true }));
  }

  function setValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = Object.getPrototypeOf(control) as object;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(control, value);
    else control.value = value;
    dispatchChanges(control);
  }

  function setChecked(control: HTMLInputElement, checked: boolean) {
    const prototype = Object.getPrototypeOf(control) as object;
    const setter = Object.getOwnPropertyDescriptor(prototype, "checked")?.set;
    if (setter) setter.call(control, checked);
    else control.checked = checked;
    dispatchChanges(control);
  }

  function labelFor(control: HTMLInputElement): string {
    if (control.id) {
      const explicit = Array.from(document.querySelectorAll("label")).find(
        (label) => label.htmlFor === control.id
      );
      if (explicit?.textContent) return explicit.textContent;
    }
    return control.closest("label")?.textContent ?? control.getAttribute("aria-label") ?? "";
  }

  function result(
    instruction: FieldFillInstruction,
    status: FieldFillResult["status"],
    message: string
  ): FieldFillResult {
    return { fieldId: instruction.fieldId, status, message };
  }

  return instructions.map((instruction) => {
    const control = findControl(instruction);
    if (!control) return result(instruction, "not-found", "The field is no longer present on the page.");

    const input = control as HTMLInputElement;
    const actualType = input.type?.toLowerCase();
    if (actualType === "password" || actualType === "file") {
      return result(instruction, "unsupported", "Sensitive and file fields are never filled.");
    }

    if (instruction.controlType === "radio") {
      const group = controls.filter(
        (candidate) =>
          (candidate as HTMLInputElement).type === "radio" &&
          candidate.getAttribute("name") === instruction.locator.name
      ) as HTMLInputElement[];

      if (group.some((candidate) => candidate.checked)) {
        return result(instruction, "skipped-nonempty", "A radio option is already selected.");
      }

      const desired = normalize(instruction.value);
      const option = group.find(
        (candidate) =>
          normalize(candidate.value) === desired || normalize(labelFor(candidate)) === desired
      );

      if (!option) return result(instruction, "no-option", "No matching radio option was found.");
      setChecked(option, true);
      return result(instruction, "filled", "Selected the matching radio option.");
    }

    if (instruction.controlType === "checkbox") {
      if (input.checked) {
        return result(instruction, "skipped-nonempty", "The checkbox is already selected.");
      }
      const shouldCheck = ["yes", "true", "1"].includes(normalize(instruction.value));
      setChecked(input, shouldCheck);
      return result(instruction, "filled", "Updated the checkbox.");
    }

    if (instruction.controlType === "select") {
      const select = control as HTMLSelectElement;
      if (normalize(select.value)) {
        return result(instruction, "skipped-nonempty", "The dropdown already has a selection.");
      }

      const desired = normalize(instruction.value);
      const option = Array.from(select.options).find(
        (candidate) =>
          normalize(candidate.value) === desired || normalize(candidate.textContent) === desired
      );

      if (!option) return result(instruction, "no-option", "No matching dropdown option was found.");
      setValue(select, option.value);
      return result(instruction, "filled", "Selected the matching dropdown option.");
    }

    const textControl = control as HTMLInputElement | HTMLTextAreaElement;
    if (normalize(textControl.value)) {
      return result(instruction, "skipped-nonempty", "The field already contains a value.");
    }

    setValue(textControl, instruction.value);
    return result(instruction, "filled", "Filled the saved profile value.");
  });
}
