export default class pedalboardGui extends HTMLElement {
  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  // Initlialise the differents elements of the gui
  async init() {
    this.setStyle();

    this.preview = await this.loadThumbnails();
    this._root.appendChild(this.preview);

    this.board = document.createElement("div");
    this.board.id = "board";
    this._root.appendChild(this.board);

    this.saveMenu = await this.loadSaves();
    this._root.appendChild(this.saveMenu);
  }

  // Load the thumbnails of the plugins
  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let keywords = { all: [] };
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
        keywords["all"].push(el);
        pedal.descriptor.keywords.forEach((k) => {
          if (!(k in keywords)) {
            keywords[k] = [];
          }
          keywords[k].push(el);
        });
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return "../pedalboard/Gui/assets/notfound.jpg";
        }
        return `${pedal.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    let select = document.createElement("select");
    const refreshImages = (select) => {
      let keys = Object.keys(keywords);
      let currentKey = keys[select.selectedIndex];
      this.images.innerHTML = "";
      keywords[currentKey].forEach((el) => {
        this.images.appendChild(this._plug.pedals[el].img);
      });
    };
    select.addEventListener("change", (event) => refreshImages(event.target));

    for (let key of Object.keys(keywords)) {
      let filter = document.createElement("option");
      filter.innerHTML = key;
      select.appendChild(filter);
    }
    preview.appendChild(select);

    this.images = document.createElement("div");
    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      this._plug.pedals[pedals[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
  }

  // Create the save panel
  async loadSaves() {
    let file = await fetch("../pedalboard/saves.json");
    this.folders = await file.json();

    let keys = Object.keys(this.folders);

    let savesInfos = document.createElement("div");
    savesInfos.id = "savesInfos";

    let folders = this.createFolders(keys);

    this.saves = document.createElement("ul");
    this.saves.id = "saves";
    
    //Input Saving
    
    this.createDivForSaving(this.saves);
    //-----------
    this.infos = document.createElement("infos");
    this.infos.id = "infos";
    
    let foldersTitle = document.createElement("h1");
    foldersTitle.innerHTML = "Categories";
    let savesTitle = document.createElement("h1");
    savesTitle.innerHTML = "Saves";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    savesInfos.appendChild(foldersTitle);
    savesInfos.appendChild(savesTitle);
    savesInfos.appendChild(infosTitle);
    savesInfos.appendChild(folders);
    savesInfos.appendChild(this.saves);
    savesInfos.appendChild(this.infos);
    return savesInfos;
  }

  createDivForSaving(container){

    //  container
    let myDivSaving = document.createElement("div");
    container.appendChild(myDivSaving);

    //  div
    let myDivDynamic = document.createElement("div");

    //  select
    let selectSaving = document.createElement("select");
    selectSaving.id = "saveSelect";
    Object.keys(this.folders).forEach((elem) =>{
      let optTemp = document.createElement("option");
      optTemp.innerHTML = elem;
      optTemp.value = elem;
      selectSaving.appendChild(optTemp);
    })
    selectSaving.style = "padding: 2px";
    selectSaving.addEventListener("change",()=>{
      this.showSaves(selectSaving.value,myDivDynamic);
    });

    //  input
    let myInput = document.createElement("input");
    myInput.id = "saveName";
    myInput.type = "text";
    
    //  button
    let myButtonSave = document.createElement("button");
    myButtonSave.innerHTML = "save";

    
    myButtonSave.addEventListener("click", ()=>{
      this._plug.pedalboardNode.saveNodes(this.board.childNodes,selectSaving.value,myInput.value);
      this.showSaves(selectSaving.value,myDivDynamic)
    })

    this.showSaves(selectSaving.value,myDivDynamic);

    myDivSaving.appendChild(selectSaving);
    myDivSaving.appendChild(myInput);
    myDivSaving.appendChild(myButtonSave);
    myDivSaving.appendChild(myDivDynamic);
  }

  // Create a list element modifiable with double click and triggering an event with a single click
  createSaveInput(key, callback) {
    let el = document.createElement("li");

    let text = document.createElement("span");
    text.innerHTML = key;
    text.addEventListener("click", callback);
    el.append(text);

    let remove = document.createElement("button");
    remove.innerHTML = "x";
    el.append(remove);
    
    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => (text.innerHTML = e.target.value));

    text.addEventListener("dblclick", () => {
      input.value = text.innerHTML;
      text.innerHTML = "";
      text.appendChild(input);
      input.focus();
    });
    return el;
  }

  // Create the list of folders
  createFolders(keys) {
    let folders = document.createElement("ul");
    folders.id = "folders";

    keys.forEach((key) =>
      folders.appendChild(this.createSaveInput(key, () => this.showFolder(key)))
    );

    return folders;
  }

  // Show content of the folder
  showFolder(folder) {
    let saves = Object.keys(this.folders[folder]);
    this.saves.innerHTML = "";
    saves.forEach((key) =>
      this.saves.appendChild(
        this.createSaveInput(key, () => this.loadSave(folder, key))
      )
    );
  }

  // Load the save to the audioNode au show it's informations
  loadSave(folder, key) {
    console.log(folder, key);
    this.infos.innerHTML = `Categorie: ${folder}</br>Save: ${key}</br>Infos: ${JSON.stringify(
      this.folders[folder][key]
    )}`;
  }

  // Add the plugin to the board
  addPlugin(instance, img, id) {
    let contener = document.createElement("div");
    contener.id=id;
    this._root.getElementById("board").appendChild(contener);
    instance.createGui().then((gui) => {
      contener.draggable = true;
      contener.ondragstart = (event) => {
        event.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
        this.DragStartX = event.x;
      };
      contener.ondragend = (event) => {
        let origin = event.target;
        let target = this._root.elementFromPoint(event.x, event.y);
        let parent = target.parentNode;

        if (parent == this.board && origin != target) {
          this._plug.pedalboardNode.disconnectNodes(parent.childNodes);
          if (this.DragStartX > event.x) {
            parent.insertBefore(origin, target);
          } else {
            parent.insertBefore(target, origin);
          }
          this._plug.pedalboardNode.connectNodes(parent.childNodes);
        }
      };
      let cross = document.createElement("img");
      cross.src = './pedalboard/resources/croix.png';
      cross.id = 'cross';
      let nameAndCross = document.createElement("div");
      nameAndCross.append(cross);
      nameAndCross.innerHTML+=instance.name;
      nameAndCross.className = "nameAndCross";

      contener.appendChild(nameAndCross);
      contener.appendChild(gui);
      this._root.getElementById("cross").addEventListener("click", () =>{
        var board = contener.parentNode;
        this._plug.pedalboardNode.disconnectNodes(board.childNodes);
        board.removeChild(contener);
        this._plug.pedalboardNode.connectNodes(board.childNodes);
      });
    });
  }

  showSaves(folder,container){
    container.innerHTML = "";

    if(localStorage.getItem(folder) !== null){
      let jsonTemp = JSON.parse(localStorage.getItem(folder));
      Object.keys(jsonTemp).forEach((el)=>{
        let li = document.createElement("li");
        let myDiv = document.createElement("div");
        let name = document.createElement("p");
        name.innerHTML = el;
        let load = document.createElement("button");

        load.innerHTML = "load";
        load.addEventListener("click",()=>{
          let mySave = JSON.parse(localStorage.getItem(folder))[folder][el];
          this._plug.pedalboardNode.loadSaves(mySave);
        });

        li.appendChild(myDiv);
        myDiv.appendChild(name);
        name.appendChild(load);
        li.classList.add("save");
        container.appendChild(li); 
      })
    }
  }

  // Link the css
  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "../pedalboard/Gui/style.css");

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
