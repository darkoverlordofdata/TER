export default class AutomationTrack extends HTMLElement {
  constructor(paramId, param) {
    super();
    this.paramId = paramId;
    this.param = param;

    this.param.minValue = Math.max(-128, this.param.minValue);
    this.param.maxValue = Math.min(128, this.param.maxValue);

    this._root = this.attachShadow({ mode: "open" });

    this.body = document.createElement("body");

    this.createHeader();
    this.createCanvas();
    this.setStyle();

    this._root.appendChild(this.body);
  }

  createHeader() {
    let header = document.createElement("header");
    let title = document.createElement("h2");
    title.innerHTML = this.paramId;

    let label = document.createElement("label");
    label.innerHTML = "Duration (sec):";
    label.setAttribute("for", "duration");

    this.input = document.createElement("input");
    this.input.id = "duration";
    this.input.name = "duration";
    this.input.type = "number";
    this.input.min = 1;
    this.input.value = 1;

    let apply = document.createElement("button");
    apply.innerHTML = "Apply automation";
    apply.addEventListener("click", async () => {
      let node = window.instance.audioNode;
      const audioCtx = node.context;
      const { currentTime } = audioCtx;
      node.clearEvents();
      const currentValue = (await node.getParameterValues(false, this.paramId))[this.paramId].value;
      node.scheduleEvents({
        type: "wam-automation",
        data: { id: this.paramId, value: currentValue },
        time: currentTime,
      });
      for (let t = 0; t < this.domain; t += 0.01) {
        const value = this.getYfromX(t);
        node.scheduleEvents({ type: "wam-automation", data: { id: this.paramId, value }, time: currentTime + t });
      }
    });

    let remove = document.createElement("button");
    remove.id = "remove";
    remove.innerHTML = "❌";
    remove.addEventListener("click", () => {
      this.remove();
    });

    header.appendChild(title);
    header.appendChild(label);
    header.appendChild(this.input);
    header.appendChild(apply);
    header.appendChild(remove);

    this.body.appendChild(header);
  }

  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = "1500";
    this.canvas.height = "200";
    this.canvas.oncontextmenu = (e) => {
      e.preventDefault();
    };

    let ctx = this.canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.strokeStyle = "white";
    ctx.font = "12px monospace";

    let points = [];

    this.canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      let { x, y, type } = this.getMouseData(e);

      if (type == 0) {
        let newPoint = true;
        for (let point of points) {
          if (point.x > x + 5) break;
          if (Math.hypot(point.x - x, point.y - y) < 10) {
            this.selected = point;
            newPoint = false;
          }
        }

        if (newPoint) {
          points.push({ x, y });
        }
      }
      if (type == 2) {
        for (let point of points) {
          if (point.x > x + 5) {
            break;
          }
          if (Math.hypot(point.x - x, point.y - y) < 10) {
            let index = points.indexOf(point);
            points.splice(index, 1);
            break;
          }
        }
      }

      points.sort((a, b) => a.x - b.x);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      e.preventDefault();
      let { x, y } = this.getMouseData(e);
      this.mouseX = x;
      this.mouseY = y;
      if (this.selected) {
        this.selected.x = x;
        this.selected.y = y;
      }
    });

    const dropped = (e) => {
      e.preventDefault();
      this.selected = undefined;
      points.sort((a, b) => a.x - b.x);
    };

    this.canvas.addEventListener("mouseup", dropped);
    this.canvas.addEventListener("mouseleave", (e) => {
      dropped(e);
      this.mouseX = undefined;
      this.mouseY = undefined;
    });

    const draw = () => {
      let rect = this.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      let prevX;
      let prevY;
      for (let { x, y } of points) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        if (prevX != undefined && prevY != undefined) {
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        this.setText(ctx, x, y);
        prevX = x;
        prevY = y;
      }

      if (this.mouseX) {
        this.setText(ctx, this.mouseX, this.mouseY);
      }

      window.requestAnimationFrame(draw);
    };

    window.requestAnimationFrame(draw);

    this.body.appendChild(this.canvas);
  }

  getMouseData(e) {
    let rect = this.canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    let type = e.button;

    return { x, y, type };
  }

  getTime(x) {
    let rect = this.canvas.getBoundingClientRect();
    return ((x * this.input.value) / rect.width).toFixed(2);
  }

  getValue(y) {
    let rect = this.canvas.getBoundingClientRect();
    return ((y * (this.param.minValue - this.param.maxValue)) / rect.height + this.param.maxValue).toFixed(2);
  }

  setText(ctx, x, y) {
    let rect = this.canvas.getBoundingClientRect();
    let firstHalf = `${this.getValue(y)} `;
    let secondHalf = `| ${this.getTime(x)}s`;

    let mid = ctx.measureText("|").width / 2;
    let firstHalfWidth = ctx.measureText(firstHalf).width;
    let secondHalfWidth = ctx.measureText(secondHalf).width;

    let offsetX = firstHalfWidth + mid;
    let offsetY = 12;

    if (x + secondHalfWidth > rect.width) {
      offsetX += x + secondHalfWidth - rect.width - mid;
    }
    if (x - firstHalfWidth < rect.x) {
      offsetX -= firstHalfWidth + mid - x;
    }
    if (y - offsetY * 2 < 0) {
      offsetY = y - offsetY;
    }

    ctx.fillText(`${firstHalf}${secondHalf}`, x - offsetX, y - offsetY);
  }

  setStyle() {
    let style = document.createElement("style");
    style.innerHTML = `
    body {
        margin: 0;
        width: 1500px;
    }

    header {
        display: flex;
        background: black;
        color: white;
        justify-content: flex-end;
        align-items: center;
        padding: 0.5rem 0.1rem 0.5rem 1rem;
        gap: 0.3rem;
    }

    h2 {
        margin: 0;
        margin-right: auto;
    }

    input {
        width: 3rem;
    }

    #remove {
        background: none;
        border: none;
        margin-left: 3rem;
        font-size: 2rem;
        line-height: 0;
        padding: 0;
    }

    canvas {
        background: black;
        border-top: 5px solid white;
    }
    `;
    this.body.appendChild(style);
  }
}

customElements.define("automation-track", AutomationTrack);
