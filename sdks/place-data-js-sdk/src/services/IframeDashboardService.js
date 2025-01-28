import IframeMessenger from '../utils/IframeMessenger.js';
import { DASHBOARDS_REQUEST_IMAGES_FETCH, DASHBOARDS_EVENT_DATA_ON_CHANGE, DASHBOARDS_EVENT_ON_UPDATE } from '../constants.js';


export default class IframeDashboardService {
        #iframeMessenger;
        

        constructor(target, options = {}) {
            this.#iframeMessenger = new IframeMessenger({
                source: target
            });
        }

        // TODO: on change yuma lógica assim 
        handleFetchImages(handler) { // handleFetchImages
            this.#iframeMessenger.registerRequestHandler(DASHBOARDS_REQUEST_IMAGES_FETCH, handler);
        }
        
        onDataUpdate(callback) {
            const wrapper = (data) => {
                try {
                    const parsedData = JSON.parse(data);
                    callback(parsedData);
                } catch (error) {
                    console.error('Error parsing data', error);
                }
            }
            return this.#iframeMessenger.registerEventsHandler(DASHBOARDS_EVENT_DATA_ON_CHANGE, wrapper);
        }

        notifyUpdate = () => { // updated
            this.#iframeMessenger.sendEvent(DASHBOARDS_EVENT_ON_UPDATE);
        }

}

