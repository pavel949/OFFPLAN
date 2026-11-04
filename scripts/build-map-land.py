# Usage: python3 scripts/build-map-land.py SOURCE.geojson OUTPUT.json
# Requires Shapely; source and public-domain attribution: public/map-assets/NOTICE.md.
import sys,json,pathlib,math,hashlib
from shapely.geometry import shape,box,mapping
p=pathlib.Path(sys.argv[1]);raw=json.loads(p.read_text());clip=box(90,-11,125,25);paths=[];rings=0;points=0
for feature in raw['features']:
 g=shape(feature['geometry'])
 if not g.intersects(clip):continue
 g=g.intersection(clip).simplify(.0004,preserve_topology=True)
 polygons=[g] if g.geom_type=='Polygon' else list(g.geoms)
 for poly in polygons:
  if poly.geom_type!='Polygon':continue
  for ring in [poly.exterior,*poly.interiors]:
   coords=[]
   for lng,lat in ring.coords:coords.append((lng,-math.log(math.tan(math.pi/4+lat*math.pi/360))*180/math.pi))
   paths.append('M'+'L'.join(f'{x:.5f},{y:.5f}' for x,y in coords)+'Z');rings+=1;points+=len(coords)
out={'version':1,'source':{'name':'Natural Earth 1:10m land','url':'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/','license':'Public domain','terms':'https://www.naturalearthdata.com/about/terms-of-use/','source_sha256':hashlib.sha256(p.read_bytes()).hexdigest()},'bounds':[90,-11,125,25],'generalized':True,'path':''.join(paths)}
dest=pathlib.Path(sys.argv[2]);dest.write_text(json.dumps(out,separators=(',',':')));print('Offline public-domain vector land:',rings,'rings',points,'points',dest.stat().st_size,'bytes')
