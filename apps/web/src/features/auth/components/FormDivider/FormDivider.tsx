interface FormDividerProps {
  text?: string;
}

export function FormDivider({ text = "Or continue with" }: FormDividerProps) {
  return (
    <div className="relative my-2">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card text-muted-foreground px-2">{text}</span>
      </div>
    </div>
  );
}
