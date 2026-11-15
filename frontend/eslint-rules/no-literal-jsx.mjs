const LOCALISABLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);

const hasLetters = (value) => /\p{L}/u.test(value);

/** @type {import('eslint').Rule.RuleModule} */
const noLiteralJsx = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require user-visible JSX text and localisable attributes to come from the i18n catalogue",
    },
    schema: [],
    messages: {
      literalText:
        "Hard-coded UI text is not allowed. Use t('some.key') from useI18n().",
      literalAttribute:
        "Hard-coded '{{name}}' attribute is not allowed. Use t('some.key').",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (hasLetters(node.value)) {
          context.report({ node, messageId: "literalText" });
        }
      },
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : "";
        if (!LOCALISABLE_ATTRIBUTES.has(name)) return;
        if (
          node.value &&
          node.value.type === "Literal" &&
          typeof node.value.value === "string" &&
          hasLetters(node.value.value)
        ) {
          context.report({
            node,
            messageId: "literalAttribute",
            data: { name },
          });
        }
      },
    };
  },
};

export default noLiteralJsx;
