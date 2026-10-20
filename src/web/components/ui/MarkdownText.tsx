import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./MarkdownText.module.css";

type MarkdownTextProps = {
  children: string;
  className?: string;
};

const EXTERNAL_LINK = /^https?:\/\//i;

/** react-markdown passes its AST `node`; it must not reach the DOM element. */
function withoutNode<Props extends ExtraProps>({ node, ...props }: Props): Omit<Props, "node"> {
  void node;
  return props;
}

function MarkdownLink(props: ComponentPropsWithoutRef<"a"> & ExtraProps) {
  const { href, ...linkProps } = withoutNode(props);
  const isExternal = href !== undefined && EXTERNAL_LINK.test(href);
  return (
    <a href={href} {...linkProps} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})} />
  );
}

function MarkdownTable(props: ComponentPropsWithoutRef<"table"> & ExtraProps) {
  return (
    <div className={styles.tableWrapper}>
      <table {...withoutNode(props)} />
    </div>
  );
}

// The text sits inside a Card (h2) under the page h1, so markdown headings
// start at h3 to keep the document outline and not compete with the page title.
const COMPONENTS: Components = {
  h1: (props) => <h3 {...withoutNode(props)} />,
  h2: (props) => <h4 {...withoutNode(props)} />,
  h3: (props) => <h5 {...withoutNode(props)} />,
  h4: (props) => <h6 {...withoutNode(props)} />,
  h5: (props) => <h6 {...withoutNode(props)} />,
  a: MarkdownLink,
  table: MarkdownTable,
};

/**
 * Renders Markdown (GFM) as formatted text. Raw HTML in the source is not
 * rendered (no rehype-raw), and the default urlTransform drops unsafe URLs
 * such as `javascript:`, so LLM-generated text cannot inject markup.
 */
export function MarkdownText({ children, className }: MarkdownTextProps) {
  return (
    <div className={[styles.markdown, className].filter(Boolean).join(" ")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
