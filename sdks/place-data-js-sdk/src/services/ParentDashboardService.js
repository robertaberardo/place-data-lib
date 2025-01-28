import IframeMessenger from '../utils/IframeMessenger.js';
import { DASHBOARDS_REQUEST_IMAGES_FETCH, DASHBOARDS_EVENT_DATA_ON_CHANGE, DASHBOARDS_EVENT_ON_UPDATE } from '../constants.js';

export default class ParentDashboardService {
    #iframe;
    #iframeMessenger;

    constructor(iframe, options = {}) {
        this.#iframe = iframe;
        this.#iframeMessenger = new IframeMessenger({
            source: iframe.contentWindow
        });
    }

    fetchImages = async () => {
        const payload = {};
        return await this.#iframeMessenger.sendRequest(DASHBOARDS_REQUEST_IMAGES_FETCH, payload);
    }

    updateData = (features, boundary) => {
        // garantir que tem features e boundary

        const message = JSON.stringify({
          features: features,
          boundary: boundary
        });
        // TODO: nesse caso específico vamos precisar trabalhar com o json.stringfy, mas idealmente removeríamos ele
        this.#iframeMessenger.sendEvent(DASHBOARDS_EVENT_DATA_ON_CHANGE, message);
    }

    onUpdate = (callback) => {
        return this.#iframeMessenger.registerEventsHandler(DASHBOARDS_EVENT_ON_UPDATE, callback);
    }
}

