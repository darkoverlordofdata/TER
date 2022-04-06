import CompositeAudioNode from "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk-parammgr/src/CompositeAudioNode.js";

export default class PedalBoardNode extends CompositeAudioNode {
  /**
   * @type {ParamMgrNode}
   */
  _wamNode = undefined;

  nodes = {};
  pedalBoardInfos = {};
  lastParameterValue = {};

  /**
   * @param {ParamMgrNode} wamNode
   */
  setup(wamNode) {
    this._wamNode = wamNode;
    this.connectNodes([]);
  }

  constructor(context, options) {
    super(context, options);
    this.createNodes();
  }

  /**
   * Create the input and outpur nodes of the PedalBoard.
   * @author Quentin Beauchet
   */
  createNodes() {
    this._input = this.context.createGain();
    this.connect(this._input);
    this._output = this.context.createGain();
  }

  /**
   * Connect every nodes from the board of the Gui.
   * @param {HTMLCollection} nodes
   * @author Quentin Beauchet
   */
  connectNodes(nodes) {
    this.lastNode = this._input;
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.connect(audioNode);
      this.lastNode = audioNode;
    });

    this.lastNode.connect(this._output);
    this.updateInfos();
  }

  /**
   * Disconnects every nodes from the board of the Gui. It then check the nodes stored in this.nodes and
   * if they aren't needed anymore it delete them from the object.
   * @param {HTMLCollection} nodes
   * @author Quentin Beauchet
   */
  disconnectNodes(nodes) {
    this.lastNode = this._input;
    var connectedIds = [];
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.disconnect(audioNode);
      this.lastNode = audioNode;
      connectedIds.push(el.id);
    });
    this.lastNode.disconnect(this._output);

    Object.keys(this.nodes).forEach((el) => {
      if (!connectedIds.includes(el)) delete this.nodes[el];
    });
    this.connectNodes([]);
  }

  /**
   * Connect audioNode at the end of the PedalBoard beetween this.lastNode and this._output.
   * @param {WamNode} audioNode
   * @author Quentin Beauchet
   */
  connectPlugin(audioNode) {
    this.lastNode.disconnect(this._output);
    this.lastNode.connect(audioNode);

    audioNode.connect(this._output);
    this.lastNode = audioNode;
  }

  /**
   * Add the audioNode the the audio of the PedalBoard,then it calls updateInfos() to refresh the automation labels.
   * @param {WamNode} audioNode The audioNode.
   * @param {string} pedalName The name of the node.
   * @param {int} id The unique id of the node, it help to map the audioNode to it's Gui.
   * @author Quentin Beauchet
   */
  addPlugin(audioNode, pedalName, id) {
    this.connectPlugin(audioNode);
    this.nodes[id] = { name: pedalName, node: audioNode };
    this.updateInfos();
  }

  /**
   * Returns the state of the PedalBoard, it's an object containing the state of each of it's nodes plus the output node.
   * @returns The state of the PedalBoard
   * @author Quentin Beauchet, Yann Forner
   */
  async getState() {
    let outputStateCurrent = []; 
    for (const key in this.nodes) {
      let module = this.nodes[key];
      for (let i = 0; i < this._wamNode.module.gui.board.childNodes.length; i++) {
        const element = this._wamNode.module.gui.board.childNodes[i];
        if (element.innerText === module.name){
          outputStateCurrent[i] = {name: module.name, state: await module.node.getState()}
          break;
        }
      }
    }
    let copySave = {...this._wamNode.module.gui.folders}
    return  {current : outputStateCurrent, save : copySave, output :this._output.gain.value} ;
  }

  /**
   * This function clear the board, disconnect all the modules, add the new modules from the param and set their states
   * @param {dict}  state the saved Dict
   * @author  Yann Forner
   */
   async setState(state) {
    this._wamNode.module.gui.folders = state.save;
    this.disconnectNodes(this._wamNode.module.gui.board.childNodes);
    this._wamNode.module.loadSave(state.current);
    this._wamNode.module.gui.board.innerHTML = "";
    this._output.gain.value = state.output;
    this._wamNode.module.gui.refreshSaves();
  }

  /**
   * Trigger an event to inform the ParamMgrNode of a change in order or an addition/deletion of the nodes in the PedalBoard.
   * @author Quentin Beauchet
   */
  updateInfos() {
    this._wamNode.dispatchEvent(
      new CustomEvent("wam-info", {
        detail: { data: this },
      })
    );
  }

  /**
   * If we don't already store the informations, we get it from each nodes in the PedalBoard and we give each a
   * unique key with the order of the nodeName and the label. If this.pedalBoardInfos is not empty, for each id passed as parameter we
   * return the information stored in it.
   * @param  {string[]} parameterIdQuery A list a node parameters ids.
   * @returns A object including informations aboput each parameter id passed as parameters.
   * @author Quentin Beauchet
   */
  async getParameterInfo(...parameterIdQuery) {
    if (parameterIdQuery.length == 0) {
      this.pedalBoardInfos = {
        "PedalBoard/Mix": {
          id: "PedalBoard/Mix",
          defaultValue: 1,
          label: "Mix",
          maxValue: 1,
          minValue: 0,
          type: "float",
        },
      };
      var pedalNames = {};

      const keys = Object.keys(this.nodes);
      var childInfos = await Promise.all(keys.map((key) => this.nodes[key].node.getParameterInfo()));
      childInfos.forEach((child, i) => {
        const infos = Object.keys(child);
        const pedalName = this.nodes[keys[i]].name;
        pedalNames[pedalName] = pedalNames[pedalName] == undefined ? 0 : pedalNames[pedalName] + 1;

        infos.forEach((key) => {
          let info = child[key];
          info.pedalId = keys[i];
          info.label = `n°${i} ${pedalName} -> ${info.label}`;
          this.pedalBoardInfos[info.label] = info;
        });
      });
      return this.pedalBoardInfos;
    } else {
      return parameterIdQuery.reduce((infos, id) => {
        infos[id] = this.pedalBoardInfos[id];
        return infos;
      }, {});
    }
  }

  /**
   * Returns the parameter values from a node in the PedalBoard, we also store the response in this.lastParameterValue
   * if we need it inside scheduleEvents().
   *
   * @param {boolean} normalized This parameter is heredited from CompositeAudioNode but it is not used.
   * @param {string} parameterIdQuery The id of the node in the PedalBoard, it was set in getParameterInfo().
   * @returns The parameter values of the node.
   * @author Quentin Beauchet
   */
  async getParameterValues(normalized, parameterIdQuery) {
    let parameter = this.pedalBoardInfos[parameterIdQuery];
    if (parameter) {
      if (parameter.id == "PedalBoard/Mix") {
        return { [parameterIdQuery]: this._output.gain };
      }
      this.lastParameterValue = await this.nodes[parameter.pedalId].node.getParameterValues();
      return { [parameterIdQuery]: this.lastParameterValue[parameter.id] };
    }
  }

  /**
   * When an event is sent to the PedalBoard, then we get the info from the event data
   * and if the id is PedalBoard/Mix we change the _output node of the PedalBoard.
   * Otherwise we get the informations from the last node where the getParameterValues()
   * was called and we propagate the event to it.
   *
   * @param  {WamEvent[]} events List of events to propagate to the nodes in the PedalBoard.
   * @author Quentin Beauchet
   */
  scheduleEvents(...events) {
    events.forEach((event) => {
      const { type, data, time } = event;
      const info = this.pedalBoardInfos[data.id];
      if (info.id == "PedalBoard/Mix") {
        this._output.gain.value = data.value;
      } else {
        const { id, normalized } = this.lastParameterValue[info.id];
        this.nodes[info.pedalId].node.scheduleEvents({
          type,
          time,
          data: { id, normalized, value: data.value },
        });
      }
    });
    this._wamNode.call("scheduleEvents", ...events);
  }
}
