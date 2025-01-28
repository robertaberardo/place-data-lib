/**
 * Structured error that can be used for errors on requests,
 * such as data validation errors.
 *
 * A handler can throw this error and it will properly be serialized
 * as part of the reply and deserialized on the other side. This allows
 * to return errors with additional context as a low-level primitive.
 */
export class RequestError extends Error {
    type;
    data;
    constructor(message, type, data, options) {
        super(message, {
            cause: options?.cause,
        });
        this.type = type;
        this.data = data;
        this.name = "RequestError";
    }
}
function parseErrorPayload(payload) {
    if (payload instanceof Error) {
        return payload;
    }
    if (payload != null &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string" &&
        "type" in payload &&
        typeof payload.type === "string" &&
        "data" in payload) {
        return new RequestError(payload.message, payload.type, payload.data);
    }
    // We don't expect this to happen, as we should either
    // be returning actual Error objects or our custom structure.
    console.error("Unknown error", payload);
    throw new Error("Unknown error occurred. See console");
}

function toErrorPayload(error) {
    if (error instanceof RequestError) {
        return {
            message: error.message,
            type: error.type,
            data: error.data,
        };
    }
    return error;
}

const messageTypeRequest = "IFRAME-MESSAGE-REQUEST";
const messageTypeResponse = "IFRAME-MESSAGE-RESPONSE";
const messageTypeEvent = "IFRAME-MESSAGE-EVENT";


function isRequest(data) {
    return (typeof data === "object" &&
        data != null &&
        "id" in data &&
        "action" in data &&
        "type" in data &&
        data.type === messageTypeRequest);
}
/** Check if the message data received is a response. */
function isResponse(data) {
    return (typeof data === "object" &&
        data != null &&
        "id" in data &&
        "type" in data &&
        data.type == messageTypeResponse);
}
/** Check if the message data received is an event. */
function isEvent(data) {
    return (typeof data === "object" &&
        data != null &&
        "action" in data &&
        "type" in data &&
        data.type === messageTypeEvent);
}

export default class IframeMessenger {

    #origin;
    #requestHandlers;
    #eventHandlers;


    constructor(options) {
        this.debug = false

        this.source = options.source;  // No iframe, esse será o pai, no pai, esse será o iframe
        this.#origin = "*"; // por enquanto deixar assim, mas depois mudar para origin
        this.#requestHandlers = new Map();
        this.#eventHandlers = new Map();

        window.addEventListener("message", this.#messageHandler);

    }


    // MÉTODOS RELACIONADOS AO ENVIO DE REQUESTS

    /** Envia uma requisição para o outro lado da comunicação.
    */
    async sendRequest(action, payload) {
        const id = crypto.randomUUID();
        const responsePromise = this.#receiveRequestResponse(id);
        const message = {
            id,
            type: messageTypeRequest,
            action,
            payload,
        };
        const [response] = await Promise.all([
            responsePromise,
            this.source.postMessage(message, this.#origin),
        ]);
        return response;
    }


    /** Aguarda a resposta de uma requisição específica.
    */
    #receiveRequestResponse(id) {
        let callback;
        return new Promise((resolve, reject) => {
            callback = (event) => {
                if (isResponse(event.data) &&
                    event.data.id === id) {
                        console.log('event.data', event.data)
                    if (event.data.error) {
                        reject(parseErrorPayload(event.data.payload));
                    }
                    else {
                        resolve(event.data.payload);
                    }
                }
            };
            window.addEventListener("message", callback);
        }).finally(() => {
            window.removeEventListener("message", callback);
        });
    }

    // MÉTODO QUE ESCUTA MENSAGENS ENVIADAS
    #messageHandler = (message) => {
        // This method will be called on all "message" events.
        // We need to filter only those we want to handle.
        const source = message.source; // TODO: entender pq isso e não this.source

        if (this.debug) {
            console.log(`Message from origin ${message.origin}:`, message.data);
        }

        const data = message.data;
        if (isEvent(data)) {
            this.#handleEvent(data);
        }
        if (isRequest(data)) {
            console.log('isRequest', data)
            this.#handleRequest(data, source);
        }
    };



    // MÉTODOS RELACIONADOS A REQUEST HANDLERS
    // Registro do que acontece em certos tipos de requisição
    registerRequestHandler(action, handler) {
        console.log('registerRequestHandler', action, handler)
        this.#requestHandlers.set(action, handler);
    }

    #handleRequest(request, source) {
        const reply = (payload, error) => {
            const response = {
                id: request.id,
                type: messageTypeResponse,
                payload,
                error,
            };

            this.source.postMessage(response, this.#origin);

            // const targetOrigin = this.#getTargetOrigin(event.origin);
            // if (this.debug) {
            //     console.log(`Sending message to ${targetOrigin}:`, response);
            // }
        };
        const handler = this.#requestHandlers.get(request.action);

        if (!handler) {
            console.warn("Unknown action for request", request);
            reply(new Error(`Unknown action: ${request.action}`), true);
            return;
        }
        Promise.resolve()
            .then(() => handler(request.payload))
            .then((response) => {
            reply(response);
        })
            .catch((err) => {
            console.error(`Failed during request action ${request.action}`, err);
            reply(toErrorPayload(err), true);
        });
    }


    // MÉTODOS RELACIONADOS A SUBSCRIPTIONS
    async sendEvent(action, payload) {
        await this.#sendEventInternal(action, payload);
    }

    async #sendEventInternal(action, payload) {
        const message = {
            type: messageTypeEvent,
            action,
            payload,
        };
        await this.source.postMessage(message, this.#origin);
    }

    // MÉTODOS RELACIONADOS AO RECEBIMENTO DE EVENTOS
    registerEventsHandler(action, handler) {
        console.log('registerRequestHandler', action, handler)
        this.#eventHandlers.set(action, handler);
    }

    #handleEvent(data, source) {
        let { action, payload, id } = data; // TODO: source(?)
        const handler = this.#eventHandlers.get(action);

        if (!handler) {
            if (this.debug) {
                console.log(`No handler for action: ${action}`);
            }
            return;
        }

        handler(payload);
    }

    
}