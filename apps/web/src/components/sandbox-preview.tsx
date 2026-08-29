interface SandboxPreviewProps {
  readonly document: string;
}

export function SandboxPreview({ document }: SandboxPreviewProps) {
  return (
    <iframe
      className="sandbox-preview"
      title="과학 체험 격리 미리보기"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={document}
    />
  );
}
