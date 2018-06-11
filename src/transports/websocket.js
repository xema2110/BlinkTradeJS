/**
 * BlinkTradeJS SDK
 * (c) 2016-present BlinkTrade, Inc.
 *
 * This file is part of BlinkTradeJS
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @flow
 */

import nodeify from 'nodeify';
import EventEmitter from 'eventemitter2';
import { getMac } from '../util/macaddress';
import { getStun, closeStun } from '../util/stun';

import Transport, { IS_NODE, IS_BROWSER } from './transport';

import {
  getRequest,
  setRequest,
  deleteRequest,
  getListener,
  getEventEmitter,
} from '../listener';

class WebSocketTransport extends Transport {
  /*
   * WebSocket Instance
   */
  socket: WebSocket;

  /*
   * FingerPrint
   */
  fingerPrint: string;

  /*
   * Stun object
   */
  stuntip: Stun;

  /*
   * Transport Promise
   */
  request: Request;

  /*
   * Event emitter to dispatch websocket updates
   */
  eventEmitter: EventEmitter;

  headers: Object;

  constructor(params?: BlinkTradeWS = {}) {
    super(params, params.brokerId === 11 ? 'wsBitcambio' : 'ws');

    this.stun = { local: null, public: [] };

    this.getStun();
    this.getFingerPrint(params.fingerPrint);
    this.headers = params.headers;

    this.eventEmitter = new EventEmitter({ wildcard: true, delimiter: ':' });
  }

  connect(callback?: Function): Promise<Object> {
    return nodeify.extend(new Promise((resolve, reject) => {
      this.request = { resolve, reject };

      const WebSocket = IS_NODE ? require('ws') : window.WebSocket;

      this.socket = new WebSocket(this.endpoint, null, this.headers);
      this.socket.onopen = this.onOpen.bind(this);
      this.socket.onclose = this.onClose.bind(this);
      this.socket.onerror = this.onError.bind(this);
      this.socket.onmessage = this.onMessage.bind(this);
    })).nodeify(callback);
  }

  disconnect(): void {
    this.socket.close();
    this.closeStun();
  }

  onOpen(): void {
    this.request.resolve({ connected: true });
  }

  onClose(): void {
  }

  onError(error: any): void {
    this.request.reject(error);
  }

  sendMessage(msg: Object): void {
    if (this.socket.readyState === 1) {
      const data = msg;

      data.STUNTIP = this.stun;
      data.FingerPrint = this.fingerPrint;

      this.socket.send(JSON.stringify(data));
    }
  }

  sendMessageAsPromise(msg: Object): Promise<Object> {
    return new Promise((resolve, reject) => {
      const promise = { resolve, reject };
      setRequest(msg, { resolve, reject });
      // We are passing the promise as a parameter to spy it in our tests
      this.sendMessage(msg, promise);
    });
  }

  onMessage(msg: Object): void {
    const data = JSON.parse(msg.data);
    if (data.MsgType === 'ERROR') {
      throw new Error(`Error: ${data.Detail} ${data.Description}`);
    }

    const request = getRequest(data);
    const emitter = getEventEmitter(data);
    const listener = getListener(data.MsgType);

    this.dispatchPromise(request, data);
    this.dispatchEventEmitters(emitter, data);
    this.dispatchListeners(listener, data);
  }

  dispatchPromise(request: ?Request, data: Object): any {
    if (request && request.resolve) {
      deleteRequest(data);
      return request.resolve(data);
    }
  }

  dispatchEventEmitters(emitter, data: Object): any {
    if (emitter) {
      return emitter(data);
    }
  }

  dispatchListeners(listener: Function, data: Object): void {
    return listener && listener(data);
  }

  getFingerPrint(customFingerprint?: string): void {
    if (IS_NODE) {
      return getMac(macAddress => {
        this.fingerPrint = macAddress;
      });
    } else if (IS_BROWSER) {
      const Fingerprint2 = require('fingerprintjs2');
      return new Fingerprint2().get(fingerPrint => {
        this.fingerPrint = Math.abs(require('../util/hash32').encodeByteArray(fingerPrint)).toString();
      });
    } else if (customFingerprint) {
      this.fingerPrint = customFingerprint;
    } else {
      throw new Error('FingerPrint not provided');
    }
  }

  getStun(): void {
    if (IS_NODE) {
      getStun(data => {
        this.stun = data;
      });
    }
  }

  closeStun(): void {
    if (IS_NODE) {
      closeStun();
    }
  }

  /* eslint-disable no-param-reassign */
  emitterPromise<T>(promise: Object, callback?: Function): PromiseEmitter<T> {
    promise.on = (event: string, listener: Function) => {
      this.eventEmitter.on(event, listener);
      return promise;
    };
    promise.onAny = (listener: Function) => {
      this.eventEmitter.onAny(listener);
      return promise;
    };
    promise.offAny = (listener: Function) => {
      this.eventEmitter.offAny(listener);
      return promise;
    };
    promise.once = (event: string, listener: Function) => {
      this.eventEmitter.once(event, listener);
      return promise;
    };
    promise.many = (event: string, times: number, listener: Function) => {
      this.eventEmitter.many(event, times, listener);
      return promise;
    };
    promise.removeListener = (event: string, listener: Function) => {
      this.eventEmitter.removeListener(event, listener);
      return promise;
    };
    promise.removeAllListeners = (events: Array<string>) => {
      this.eventEmitter.removeAllListeners(events);
      return promise;
    };

    return nodeify.extend(promise).nodeify(callback);
  }
  /* eslint-enable no-param-reassign */
}

export default WebSocketTransport;
