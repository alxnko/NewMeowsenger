import clsx from "clsx";
import React from "react";

export default function Container({
  id,
  className,
  children,
}: UITemplateWithChildren) {
  return (
    <section
      id={id}
      className={clsx(
        "flex flex-col items-center justify-center gap-4 py-8 md:py-10 min-h-screen",
        className
      )}
    >
      {children}
    </section>
  );
}
