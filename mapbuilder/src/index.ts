
function main() {
    const canvas = <HTMLCanvasElement>document.getElementById("canvas");
    const ctx = canvas.getContext('2d');

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.translate(width / 2, height / 2);


    ctx.strokeStyle = "#333"
    draw_grid(
        ctx, [width, 100, 20], [width / 2, height / 2], [width, height],
        4, 0.30
    );
    ctx.fillStyle = "#ff5f00";

    ctx.fillRect(0, 0, 100, 100);

    console.log("hallo");
}

function draw_grid(
    ctx: CanvasRenderingContext2D,
    lines: number[],    // number of pixels between lines, with smaller gettings lines
    transform: [number, number],
    size: [number, number],
    init_width = 2, factor = 0.5) {

    ctx.save();

    ctx.translate(-transform[0], -transform[1]);


    for (let delta of lines) {
        ctx.lineWidth = init_width;

        let xoff = transform[0] % delta;
        let yoff = transform[1] % delta;

        ctx.beginPath();

        for (let i = xoff; i < size[0]; i += delta) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size[1]);
        }
        for (let j = yoff; j < size[1]; j += delta) {
            ctx.moveTo(0, j);
            ctx.lineTo(size[0], j);
        }

        ctx.stroke();

        init_width *= factor;
    }

    ctx.restore();
}

setTimeout(main, 200);
