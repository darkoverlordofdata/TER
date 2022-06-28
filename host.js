const player = document.querySelector("#player");
const mount = document.querySelector("#mount");

const saveState = document.getElementById("save");
const restoreState = document.getElementById("restore");
const deleteState = document.getElementById("delete");
const inCache = document.getElementById("inCache");

inCache.setAttribute("data", localStorage.getItem("instanceState") != null);

// Safari...
const AudioContext =
  window.AudioContext || // Default
  window.webkitAudioContext || // Safari and old versions of Chrome
  false;

const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);

// Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
  mediaElementSource.connect(audioNode);
  audioNode.connect(audioContext.destination);
};

// Very simple function to append the plugin root dom node to the host
const mountPlugin = (domNode) => {
  mount.innerHtml = "";
  mount.appendChild(domNode);
};

(async () => {
  // Init WamEnv
  const { default: initializeWamHost } = await import("../plugins/utils/sdk/src/initializeWamHost.js");
  const [hostGroupId] = await initializeWamHost(audioContext);

  // Import WAM
  const { default: WAM } = await import("./pedalboard/index.js");
  // Create a new instance of the plugin
  // You can can optionnally give more options such as the initial state of the plugin
  const instance = await WAM.createInstance(hostGroupId, audioContext);

  window.instance = instance;

  // Connect the audionode to the host
  connectPlugin(instance.audioNode);

  // Load the GUI if need (ie. if the option noGui was set to true)
  // And calls the method createElement of the Gui module
  const pluginDomNode = await instance.createGui();

  mountPlugin(pluginDomNode);

  player.onplay = () => {
    audioContext.resume(); // audio context must be resumed because browser restrictions
  };

  saveState.addEventListener("click", async () => {
    let state = await instance.audioNode.getState();
    localStorage.setItem("instanceState", JSON.stringify(state));
    inCache.setAttribute("data", true);
  });

  restoreState.addEventListener("click", async () => {
    let state = localStorage.getItem("instanceState");
    if (state) {
      await instance.audioNode.setState(JSON.parse(state));
    }
  });

  deleteState.addEventListener("click", async () => {
    localStorage.removeItem("instanceState");
    inCache.setAttribute("data", false);
  });
})();
