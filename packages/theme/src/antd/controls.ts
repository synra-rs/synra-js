/** Input capability also covers touch enabled desktop windows. */
export function controlCss(): string {
  return `
.synra-icon-button.ant-btn {
  width: var(--synra-control-compact);
  height: var(--synra-control-compact);
  padding: 0;
}
@media (any-pointer: coarse) {
  .ant-btn, .ant-input:not(textarea), .ant-input-affix-wrapper,
  .ant-select-single, .ant-select-single .ant-select-selector,
  .synra-icon-button, .synra-choice {
    min-height: var(--synra-control-touch);
  }
  .ant-select-single .ant-select-selection-item,
  .ant-select-single .ant-select-selection-placeholder {
    line-height: var(--synra-control-touch);
  }
  .synra-icon-button, .ant-btn-icon-only {
    min-width: var(--synra-control-touch);
  }
  .ant-input-affix-wrapper .ant-input {
    min-height: auto;
  }
  .ant-checkbox-wrapper {
    min-height: var(--synra-control-touch);
    align-items: center;
  }
  .ant-switch::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block: calc((100% - var(--synra-control-touch)) / 2);
  }
}
`
}
