interface FormDividerProps {
  text?: string;
}

export function FormDivider({ text = "or" }: FormDividerProps) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />
      {text}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
