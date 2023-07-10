import { TilesRenderer } from '3d-tiles-renderer'
import { TileBoundingVolume } from '3d-tiles-renderer/src/three/math/TileBoundingVolume.js';
import {Matrix4} from "three";
export class LayerTilesRenderer extends TilesRenderer {

  preprocessNode( tile, tileSetDir, parentTile ) {

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    super.preprocessNode( tile, tileSetDir, parentTile );

    const transform = new Matrix4();

    if ( tile.transform ) {

      if(!parentTile){
        tile.transform[0] = 1
        tile.transform[1] = 0
        tile.transform[2] = 0
        tile.transform[3] = 0
        tile.transform[4] = 0
        tile.transform[5] = 1
        tile.transform[6] = 0
        tile.transform[7] = 0
        tile.transform[8] = 0
        tile.transform[9] = 0
        tile.transform[10] = 1
        tile.transform[11] = 0
        tile.transform[ 12 ] = 0
        tile.transform[ 13 ] = 0
        tile.transform[ 14 ] = 0
        tile.transform[ 15 ] = 1.0
      }

      const transformArr = tile.transform;
      for ( let i = 0; i < 16; i ++ ) {

        transform.elements[ i ] = transformArr[ i ];

      }
    } else {

      transform.identity();

    }

    if ( parentTile ) {

      transform.premultiply( parentTile.cached.transform );

    }

    const transformInverse = new Matrix4().copy( transform ).invert();
    const boundingVolume = new TileBoundingVolume();

    if ( 'sphere' in tile.boundingVolume ) {

      console.warn( 'ThreeTilesRenderer: sphere bounding volume not supported.' );

    }

    if ( 'box' in tile.boundingVolume ) {

      boundingVolume.setObbData( tile.boundingVolume.box, transform );

    }

    if ( 'region' in tile.boundingVolume ) {

      console.warn( 'ThreeTilesRenderer: region bounding volume not supported.' );

    }

    tile.cached = {

      loadIndex: 0,
      transform,
      transformInverse,

      active: false,
      inFrustum: [],

      boundingVolume,

      scene: null,
      geometry: null,
      material: null,

    };

  }

  dispose() {

    super.dispose();
    const _this = this as any
    _this.lruCache.itemList.forEach( tile => {
      _this.disposeTile( tile );
    } );
    _this.lruCache.itemSet.clear();
    _this.lruCache.itemList = [];
    _this.lruCache.callbacks.clear();
    _this.lruCache = null;
    _this.visibleTiles.clear();
    _this.activeTiles.clear();
    _this.downloadQueue.callbacks.clear();
    _this.downloadQueue.items = [];
    _this.downloadQueue = null;
    _this.parseQueue.callbacks.clear();
    _this.parseQueue.items = [];
    _this.parseQueue = null;
    this.clearGroup( this.group );
    _this.tileSets = {};
    _this.cameraMap.clear();
    _this.cameras = [];
    _this.cameraInfo = [];
    _this.group = null;

  }

  clearGroup( group ) {
    group.traverse( ( item ) => {

      if ( item.isMesh ) {

        item.geometry.dispose();
        item.material.dispose();
        if ( item.material.texture && item.material.texture.dispose ) {

          item.material.texture.dispose();

        }

      }
      delete item.featureTable;
      delete item.batchTable;

    } );
    delete group.tilesRenderer;
    group.remove( ...group.children );

  }
}
