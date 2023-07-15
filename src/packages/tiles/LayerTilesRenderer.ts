import { TilesRenderer } from '3d-tiles-renderer'
import {Matrix4, Vector3, Quaternion} from "three";
export class LayerTilesRenderer extends TilesRenderer {

  preprocessNode( tile, tileSetDir, parentTile ) {

    if ( tile.transform ) {

      if ( ! parentTile ) {
        const matrix = new Matrix4().fromArray( tile.transform );
        const position = new Vector3();
        const scale = new Vector3();
        const quaternion = new Quaternion();
        matrix.decompose(position, quaternion, scale);
        quaternion.setFromAxisAngle( new Vector3( 0, 0, 1 ), 0 );
        matrix.compose(position, quaternion, scale);
        tile.transform = matrix.toArray();

      }

    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    super.preprocessNode( tile, tileSetDir, parentTile );

    /*if ( 'region' in tile.boundingVolume && ! parentTile) {
      console.log('tile.cached.transform: ', tile.cached.transform)
      const matrix = new Matrix4().fromArray( tile.cached.transform );
      matrix.makeRotationAxis( new Vector3( 0, 0, 1 ), 0 );
      tile.cached.transform = matrix.toArray();

    }*/

  }

  /*dispose() {

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

  }*/
}
