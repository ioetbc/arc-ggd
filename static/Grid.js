const GALLERY_JSON = '../static/gallery.json';
const CARD_WIDTH = 200;
const CARD_HEIGHT = 200;
const FIXED_ROWS = 4;
const FIXED_COLS = 4;

function main() {
  function LoadJSON(url, callback) {
    let req = new XMLHttpRequest();
    req.overrideMimeType('application/json');
    req.open('GET', url, true);
    req.onreadystatechange = () => {
      if (req.readyState === 4 && req.status === 200) {
        callback(JSON.parse(req.responseText));
      }
    };
    req.send(null);
  }

  class MouseMove {
    constructor(DOMElement, onDrag) {
      this.lastX = 0;
      this.lastY = 0;
      this.tween = undefined;
      this.DOMElement = DOMElement;
      this.onDragCallback = onDrag;
      this.DOMElement.onwheel = this.onMove.bind(this);
    }

    onMove(e) {
      let xDelta = e.deltaX * -1 - this.lastX;
      let yDelta = e.deltaY * -1 - this.lastY;
      let velocity = Math.abs(xDelta * yDelta);

      if (velocity > 50) {
        let v = { x: xDelta * 0.5, y: yDelta * 0.5 };
        if (this.tween) this.tween.kill();
        this.tween = TweenMax.to(v, 0.5, {
          x: 0,
          y: 0,
          onUpdate: () => {
            this.onDragCallback(v.x, v.y);
          },
        });
      }

      this.onDragCallback(xDelta, yDelta);
      this.lastX = e.deltaX;
      this.lastY = e.deltaY;
    }
  }

  class Card {
    constructor(descriptor) {
      this.descriptor = descriptor;
      this.createDOMElement();
      this.x = 0;
      this.y = 0;
    }

    createDOMElement() {
      this.rootElement = document.createElement('div');
      if (this.descriptor.type === 'video') {
        this.imgElement = document.createElement('video');
        this.imgElement.setAttribute('autoPlay', true);
        this.imgElement.setAttribute('loop', true);
        this.imgElement.setAttribute('muted', true);
      } else {
        this.imgElement = document.createElement('img');
      }
      this.rootElement.classList.add('card');
      if (!!this.descriptor.url) {
        this.rootElement.addEventListener('click', () => {
          window.location.href = `${this.descriptor.url}`;
        });
      }
      this.rootElement.appendChild(this.imgElement);
    }

    load() {
      if (this.imgElement.src !== this.descriptor.imageUrl) {
        this.imgElement.src = this.descriptor.imageUrl;
        this.imgElement.onload = () => {
          this.update();
          this.rootElement.classList.toggle('hidden', false);
        };
      }
    }

    appendTo(el) {
      if (this.rootElement.parentElement !== el) {
        el.appendChild(this.rootElement);
        this.load();
      }
    }

    removeSelf() {
      if (this.rootElement.parentElement) {
        this.rootElement.classList.toggle('hidden', true);
        this.imgElement.src = '';
        this.rootElement.parentElement.removeChild(this.rootElement);
      }
    }

    update() {
      let updateValueX = this.x * this.descriptor.speed;
      let updateValueY = this.y * this.descriptor.speed;
      this.rootElement.setAttribute(
        'style',
        `transform: translate3d(${updateValueX}px, ${updateValueY}px, 0);`
      );
      // const shadow = this.descriptor.shadow;
      // if (!!shadow) {
      //   this.imgElement.setAttribute(
      //     'style',
      //     `box-shadow: 0 ${shadow * 10}px ${
      //       shadow * 20
      //     }px rgba(0,0,0,0.30), 0 ${shadow * 7}px ${
      //       shadow * 6
      //     }px rgba(0,0,0,0.22);`
      //   );
      // }
    }
  }

  class Grid {
    constructor(DOMElement, JSONGallery) {
      this.descriptors = JSONGallery.images;
      this.DOMElement = DOMElement;
      this.cards = {};
      this.cardsPool = [];
      this.offsetX = 0;
      this.offsetY = 0;
      this.viewCols = 0;
      this.viewRows = 0;
      this.viewWidth = 0;
      this.viewHeight = 0;
      this.allCards;
    }

    init() {
      window.addEventListener('resize', this.onResize.bind(this));
      this.onResize();
      new MouseMove(this.DOMElement, this.onDrag.bind(this));
    }

    onDrag(deltaX, deltaY) {
      this.offsetX += deltaX;
      this.offsetY += deltaY;
      this.updateGrid();
    }

    onResize() {
      this.viewHeight = this.DOMElement.offsetHeight;
      this.viewWidth = this.DOMElement.offsetWidth;
      this.updateViewColRows();
      this.updateGrid();
    }

    updateViewColRows() {
      this.viewCols = Math.ceil(this.viewWidth / CARD_WIDTH) + 2;
      this.viewRows = Math.ceil(this.viewHeight / CARD_HEIGHT) + 2;
    }

    isVisible(x, y) {
      return (
        x + CARD_WIDTH > 0 &&
        y + CARD_HEIGHT > 0 &&
        x < this.viewWidth &&
        y < this.viewHeight
      );
    }

    getCardPos(col, row) {
      let offsetX = this.offsetX % CARD_WIDTH;
      let offsetY = this.offsetY % CARD_HEIGHT;
      let x = col * CARD_WIDTH + offsetX - CARD_WIDTH;
      let y = row * CARD_HEIGHT + offsetY - CARD_HEIGHT;
      return [Math.round(x), Math.round(y)];
    }

    updateGrid() {
      let newCards = {};
      let colOffset = ~~(this.offsetX / CARD_WIDTH) * -1;
      let rowOffset = ~~(this.offsetY / CARD_HEIGHT) * -1;
      for (let row = -1; row < this.viewRows; row++) {
        for (let col = -1; col < this.viewCols; col++) {
          let desc = undefined;
          let tCol = colOffset + col;
          let tRow = rowOffset + row;
          let index = Math.abs(tRow * FIXED_COLS + tCol);
          desc = this.descriptors[index % this.descriptors.length];
          let [x, y] = this.getCardPos(col, row);

          if (this.isVisible(x, y)) {
            let index = tCol + '' + tRow;
            let card = this.cards[index] || this.getCard(desc);
            delete this.cards[index];
            card.x = x;
            card.y = y;
            card.appendTo(this.DOMElement);
            card.update();
            newCards[index] = card;
          }
        }
      }
      this.cleanupCards();
      this.cards = newCards;
    }

    cleanupCards() {
      let keys = Object.keys(this.cards);
      for (let i = 0; i < keys.length; i++) {
        let card = this.cards[keys[i]];
        card.removeSelf();
        this.cardsPool.push(card);
      }
      this.cards = null;
    }

    getCard(descriptor) {
      if (this.cardsPool.length > 0) {
        let card = this.cardsPool.pop();
        card.descriptor = descriptor;
        return card;
      } else {
        return new Card(descriptor);
      }
    }
  }

  LoadJSON(GALLERY_JSON, (gallery) => {
    const grid = new Grid(document.getElementById('js-grid'), gallery);
    grid.init();
  });
}

main();
