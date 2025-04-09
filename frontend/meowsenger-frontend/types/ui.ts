interface UITemplate {
  id?: string;
  className?: string;
}

interface UITemplateWithChildren extends UITemplate {
  children: React.ReactNode;
}
