
let gridlineEls:any;
let gridlineNeedsUpdate = true;

function get_line_widths(): string[][] {
    if (gridlineNeedsUpdate) {
        gridlineEls = document.getElementsByClassName("gridline");
        gridlineNeedsUpdate = false;
    }
    const out: string[][] = [[], [], []];
    for(let el of <any[]>gridlineEls) {
        let i = 0;
        for( let c of el.getElementsByTagName('input')) {
            out[i].push(
                c.value
            );
            i += 1;
        }
    }
    return out;
}

function main() {
    const canvas = <HTMLCanvasElement>document.getElementById("canvas");
    const ctx = canvas.getContext('2d');

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width;
    canvas.height = height;

    function draw() {
        ctx.clearRect(0, 0, width, height);

        ctx.save();

        ctx.translate(width / 2, height / 2);

        ctx.strokeStyle = "#333";
        draw_grid(ctx, get_line_widths(), [width / 2, height / 2], [width, height]);
        ctx.fillStyle = "#ff5f00";

        ctx.fillRect(0, 0, 100, 100);

        ctx.restore();
        requestAnimationFrame(draw);
    }

    console.log("hallo");
    draw();

}

function draw_grid(
    ctx: CanvasRenderingContext2D,
    lines: string[][],    // number of pixels between lines, with smaller gettings lines
    transform: [number, number],
    size: [number, number]) {

    ctx.save();

    ctx.translate(-transform[0], -transform[1]);

    for (let i = lines[0].length - 1; i >= 0 ; i -= 1) {
        ctx.lineWidth = parseInt(lines[0][i]);
        const delta = parseInt(lines[1][i]);
        ctx.strokeStyle = "transparent";
        ctx.strokeStyle = lines[2][i];

        let xoff = transform[0] % delta;
        let yoff = transform[1] % delta;

        ctx.beginPath();

        for (let j = xoff; j < size[0]; j += delta) {
            ctx.moveTo(j, 0);
            ctx.lineTo(j, size[1]);
        }
        for (let j = yoff; j < size[1]; j += delta) {
            ctx.moveTo(0, j);
            ctx.lineTo(size[0], j);
        }

        ctx.stroke();
    }

    ctx.restore();
}

setTimeout(main, 200);
