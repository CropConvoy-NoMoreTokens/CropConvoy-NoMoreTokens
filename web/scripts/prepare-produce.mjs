import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const sourceArg = process.argv.indexOf('--source-dir');
if (sourceArg < 0 || !process.argv[sourceArg + 1]) throw new Error('Pass --source-dir with the folder containing the six generated originals.');
const source = path.resolve(process.argv[sourceArg + 1]);
const assets = {
 tomato:['exec-80eb75da-8e40-4f71-bbef-40c736a7bedc','Three ripe red tomatoes, one with a fresh green calyx, natural imperfect skins.'],
 potato:['exec-8f18ee65-b816-4a78-b4d4-d3af3a57c4a8','Three unpeeled golden-brown potatoes with natural skin texture, freshly brushed clean.'],
 carrot:['exec-ceb2bec3-54b7-4c47-8129-9a71adb27da6','Three fresh orange carrots with short leafy green tops, arranged diagonally as a compact bunch.'],
 banana:['exec-7ecdc135-c928-46af-b2f5-75142173f4c5','One small bunch of five ripe yellow Sri Lankan bananas, naturally curved with realistic speckling.'],
 papaya:['exec-685adc06-528e-4f8c-b026-cd43506c973d','One ripe papaya and one half papaya revealing orange flesh and black seeds, compact arrangement.'],
 pineapple:['exec-871ebc46-4dc9-452a-badf-0c27eb7c75dc','One whole ripe golden pineapple with a fresh green crown, upright with a slight natural tilt.'],
};
const output = 'public/images/produce';
await mkdir(output,{recursive:true});
for (const [name,[id]] of Object.entries(assets)) {
 const input = path.join(source,id+'.png');
 const meta = await sharp(input).metadata();
 if (!meta.hasAlpha) throw new Error(name+' missing transparency');
 for (const width of [160,320,640]) await sharp(input).resize(width,width,{fit:'contain',background:'#00000000'}).webp({quality:85,alphaQuality:100,effort:6}).toFile(path.join(output,name+'-'+width+'.webp'));
 console.log(name+': alpha verified; three responsive variants saved');
}
await writeFile('public/images/produce/provenance.json',JSON.stringify({
 tool:'Built-in image_gen; transparent_background=true',date:'2026-10-24',
 prompt_template:'Use case: product-mockup. Create a single square photorealistic produce cutout asset for the CropConvoy agricultural website. Subject: {subject} Centered three-quarter product photograph; entire subject visible with generous clear margins. Soft natural daylight from upper left, realistic tactile texture, consistent restrained commercial editorial style. Genuine transparent background with alpha, no colored or white backdrop. No props, plates, crates, people, scenery, typography, labels, logos, watermark, frame or graphic elements. The produce should occupy about 72 percent of the square, clean edges suitable on both pale cream and forest green UI surfaces. Only the specified produce.',
 assets:Object.fromEntries(Object.entries(assets).map(([name,[id,subject]])=>[name,{generation_id:id,subject,files:[160,320,640].map(w=>name+'-'+w+'.webp')}]))
},null,2));
