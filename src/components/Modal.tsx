import { createEffect, Show } from "solid-js";
import { Portal } from "solid-js/web";

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: ModalButton[];
  onClose: () => void;
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
              <p 
                class="mb-6"
                style={{"color": "var(--text-secondary)"}}
              >
                {props.message}
              </p>
              <div
                class={`flex gap-3 ${isStacked() ? "flex-col items-stretch" : "justify-end"}`}
              >
                {props.buttons.map((button) => (
                  <button
                    class={`px-4 py-2 rounded-md font-medium transition-colors ${isStacked() ? "w-full" : ""}`}
                    style={getButtonStyle(button.style)}
                    onClick={() => {
                      button.onPress();
                      props.onClose();
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
