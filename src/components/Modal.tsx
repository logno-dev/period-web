import { createEffect, For, Show } from "solid-js";
import { Portal } from "solid-js/web";

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  closeOnPress?: boolean;
}

interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: ModalButton[];
  onClose: () => void;
  listTitle?: string;
  listItems?: Array<{
    id: string;
    label: string;
  }>;
  listEmptyText?: string;
  onListItemRemove?: (id: string) => void;
}

export default function Modal(props: ModalProps) {
  const isStacked = () => props.buttons.length > 3;
  createEffect(() => {
    if (props.visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  });

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case 'cancel':
        return {
          "background-color": "var(--bg-secondary)",
          "color": "var(--text-primary)",
          "border": "1px solid var(--border-color)"
        };
      case 'destructive':
        return {
          "background-color": "var(--error-color)",
          "color": "white"
        };
      default:
        return {
          "background-color": "var(--accent-color)",
          "color": "white"
        };
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.visible}>
      <Portal>
        <div
          class="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{"background-color": "var(--modal-overlay)"}}
          onClick={handleBackdropClick}
        >
          <div 
            class="rounded-lg shadow-xl max-w-md w-full"
            style={{"background-color": "var(--modal-bg)"}}
          >
            <div class="p-6">
              <h3 
                class="text-lg font-bold mb-2"
                style={{"color": "var(--text-primary)"}}
              >
                {props.title}
              </h3>
              {props.message ? (
                <p 
                  class="mb-4"
                  style={{"color": "var(--text-secondary)"}}
                >
                  {props.message}
                </p>
              ) : null}
              {props.listTitle ? (
                <div class="mb-6">
                  <div class="text-sm font-semibold mb-2" style={{"color": "var(--text-primary)"}}>
                    {props.listTitle}
                  </div>
                  <div class="space-y-2">
                    <Show
                      when={props.listItems && props.listItems.length > 0}
                      fallback={
                        <div class="text-sm" style={{"color": "var(--text-secondary)"}}>
                          {props.listEmptyText || "None yet."}
                        </div>
                      }
                    >
                      <For each={props.listItems || []}>
                        {(item) => (
                          <div
                            class="flex items-center justify-between rounded-md px-3 py-2"
                            style={{
                              "background-color": "var(--bg-secondary)",
                              "border": "1px solid var(--border-color)"
                            }}
                          >
                            <span class="text-sm" style={{"color": "var(--text-primary)"}}>
                              {item.label}
                            </span>
                            <button
                              class="text-xs font-semibold px-2 py-1 rounded"
                              style={{
                                "background-color": "var(--error-color)",
                                "color": "white"
                              }}
                              onClick={() => props.onListItemRemove?.(item.id)}
                            >
                              X
                            </button>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              ) : null}
              <div
                class={`flex gap-3 flex-col items-stretch sm:flex-row sm:items-center ${isStacked() ? "" : "sm:justify-end"}`}
              >
                {props.buttons.map((button) => (
                  <button
                    class={`px-4 py-2 rounded-md font-medium transition-colors w-full sm:w-auto`}
                    style={getButtonStyle(button.style)}
                    onClick={() => {
                      button.onPress();
                      if (button.closeOnPress !== false) {
                        props.onClose();
                      }
                    }}
                  >
                    {button.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
