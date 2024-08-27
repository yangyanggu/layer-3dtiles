import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";
import {Vector2, Raycaster, Group, Box3, Vector3} from "three";
import {bind} from 'lodash-es';
import BaseEvent from '../event'
import { LayerTilesRenderer } from './LayerTilesRenderer'
import {gps84_To_Gcj02, convertToWGS84} from '../utils/GPSUtil'

interface Vec {
  x: number
  y: number
  z: number
}

interface Options {
  url: string //模型下载地址
  position?: number[] // 模型位置，经纬度
  rotation?: Vec // 旋转角度，一般不需要设置
  translate?: Vec // 偏移位置
  scale?: number | Vec // 模型缩放比例
  dracoDecoderPath?: string // DRACOLoader 的decoder路径，默认使用CDN路径
  fetchOptions?: any // 使用fetch下载文件的参数
  mouseEvent?: boolean // 是否开启鼠标事件，包含点击、移动、双击、右击
  debug?: boolean // 是否开启debug模式，开启后将会再最上面显示当前模型加载情况
  autoFocus?: boolean // 加载后是否自动将地图中心点移动到模型中心，仅在不传position时生效
  configLoader?: (loader: GLTFLoader) => void // 配置loader，用于添加draco等扩展
}

class Layer3DTiles extends BaseEvent{
  layer: any // threejs的图层对象
  animationFrame = -1; //gltf动画
  tilesRenderer: LayerTilesRenderer
  group: any
  statsContainer?: HTMLDivElement
  mouse: Vector2
  raycaster?: Raycaster
  clickMapFn: any
  mousemoveMapFn: any
  rightClickMapFn: any
  parentGroup: Group
  position?: number[]
  hasResetCenter = false
  options: Options

  constructor(layer: any, options: Options) {
    super();
    this.options = options;
    this.mouse = new Vector2()
    this.layer = layer;
    const tilesRenderer = new LayerTilesRenderer( options.url );
    tilesRenderer.setCamera( this.layer.getCamera() );
    tilesRenderer.setResolutionFromRenderer( this.layer.getCamera(), this.layer.getRender() );
    const fetchOptions = options.fetchOptions || {}
    const gltfLoader = new GLTFLoader(tilesRenderer.manager)
    if ( fetchOptions.credentials === 'include' && fetchOptions.mode === 'cors' ) {
      gltfLoader.setCrossOrigin( 'use-credentials' );
    }

    if ( 'credentials' in fetchOptions ) {
      gltfLoader.setWithCredentials( fetchOptions.credentials === 'include' );
    }

    if ( fetchOptions.headers ) {
      gltfLoader.setRequestHeader( fetchOptions.headers );
    }
    const dRACOLoader = new DRACOLoader()
    const dracoDecodePath = options.dracoDecoderPath || 'https://cdn.jsdelivr.net/npm/three@0.143/examples/js/libs/draco/'
    dRACOLoader.setDecoderPath(dracoDecodePath)
    gltfLoader.setDRACOLoader(dRACOLoader)
    if (options.configLoader){
      options.configLoader(gltfLoader)
    }
    tilesRenderer.manager.addHandler(/\.gltf$/i, gltfLoader)
    tilesRenderer.onLoadTileSet = (tileSet) => {
      this.emit('loadTileSet', tileSet)
    }
    tilesRenderer.onLoadModel = (scene, tile) => {
      this.emit('loadModel', {
        scene,
        tile
      })
    }
    tilesRenderer.onDisposeModel = (scene, tile) => {
      this.emit('disposeModel', {
        scene,
        tile
      })
    }
    tilesRenderer.downloadQueue.maxJobs = 6
    tilesRenderer.parseQueue.maxJobs = 6
    const contentGroup = new Group()
    this.parentGroup = new Group()
    this.parentGroup.add(tilesRenderer.group)
    contentGroup.add(this.parentGroup)
    this.group = contentGroup
    this.layer.add( this.group );
    this.tilesRenderer = tilesRenderer
    if(options.position){
      this.setPosition(options.position);
    }
    if(options.rotation){
      this.setRotation(options.rotation);
    }
    if(options.translate){
      this.setTranslate(options.translate);
    }
    if(options.scale){
      this.setScale(options.scale);
    }
    this.animate()
    if(options.debug){
      const statsContainer = document.createElement( 'div' );
      statsContainer.style.position = 'absolute';
      statsContainer.style.top = '0px';
      statsContainer.style.left = '0px';
      statsContainer.style.color = 'white';
      statsContainer.style.width = '100%';
      statsContainer.style.textAlign = 'center';
      statsContainer.style.padding = '5px';
      statsContainer.style.pointerEvents = 'none';
      statsContainer.style.lineHeight = '1.5em';
      document.body.appendChild( statsContainer );
      this.statsContainer = statsContainer
    }
    this.bindEvents(options.mouseEvent)
  }

  bindEvents(mouseEvent?:boolean){
    if(mouseEvent){
      this.raycaster = new Raycaster();
      (this.raycaster as any).firstHitOnly = true;
      const map = this.layer.getMap()
      this.clickMapFn = bind(this.clickMap, this)
      map.on('click', this.clickMapFn)
      this.mousemoveMapFn = bind(this.mousemoveMap, this)
      map.on('mousemove', this.mousemoveMapFn)
      this.rightClickMapFn = bind(this.rightClickMap, this)
      map.on('rightclick', this.rightClickMapFn)
    }
  }
  unbindEvents(){
    const map = this.layer.getMap()
    if(this.clickMapFn){
      map.off('click', this.clickMapFn)
      this.clickMapFn = null
    }
    if(this.mousemoveMapFn){
      map.off('mousemove', this.mousemoveMapFn)
      this.mousemoveMapFn = null
    }
    if(this.rightClickMapFn){
      map.off('rightclick', this.rightClickMapFn)
      this.rightClickMapFn = null
    }
    if(this.tilesRenderer){
      this.tilesRenderer.onLoadTileSet = null;
      this.tilesRenderer.onLoadModel = null;
      this.tilesRenderer.onDisposeModel = null;
    }
  }
  clickMap(e){
    const result = this._intersectGltf(e)
    this.emit('click', result)
  }

  mousemoveMap(e){
    const result = this._intersectGltf(e)
    this.emit('mousemove', result)
  }

  rightClickMap(e){
    const result = this._intersectGltf(e)
    this.emit('rightClick', result)
  }

  _intersectGltf(e) {
    const client = this.layer.getMap().getContainer();
    // 通过鼠标点击位置,计算出 raycaster 所需点的位置,以屏幕为中心点,范围 -1 到 1
    const bounds = client.getBoundingClientRect();
    const mouse = this.mouse;
    // window.pageYOffset 鼠标滚动的距离
    // clientTop 一个元素顶部边框的宽度
    mouse.x = e.originEvent.clientX - bounds.x;
    mouse.y = e.originEvent.clientY - bounds.y;
    mouse.x = ( mouse.x / bounds.width ) * 2 - 1;
    mouse.y = - ( mouse.y / bounds.height ) * 2 + 1;
    const camera = this.layer.getCamera();
    this.raycaster?.setFromCamera(mouse, camera);
    const intersects = this.raycaster?.intersectObject(this.group, true);
    if(intersects?.length){
      const obj = intersects[0].object
      const batchData = {}
      const batchTable = this.getBatchTable(obj)
      if(batchTable){
        const keys = batchTable.getKeys()
        keys.forEach( v => {
          batchData[v] = batchTable.getData(v)
        })
      }
      return {
        object: obj,
        batchData
      }
    }
    return null
  }

  getBatchTable(selectedMesh){
    if(!selectedMesh){
      return null
    }
    if(selectedMesh.batchTable){
      return selectedMesh.batchTable
    }
    return this.getBatchTable(selectedMesh.parent)
  }

  setPosition(position) {
    const positionConvert = this.layer.convertLngLat(position);
    this.group.position.setX(positionConvert[0]);
    this.group.position.setY(positionConvert[1]);
    this.refresh();
    this.position = position;
  }

  setRotation(rotation: Vec) {
    if (rotation) {
      const x = Math.PI / 180 * (rotation.x || 0);
      const y = Math.PI / 180 * (rotation.y || 0);
      const z = Math.PI / 180 * (rotation.z || 0);
      this.group.rotation.set(x, y, z);
      this.refresh();
    }
  }

  setTranslate(translate: Vec){
    if(translate){
      this.group.translateX(translate.x)
      this.group.translateY(translate.y)
      this.group.translateZ(translate.z)
      this.refresh()
    }
  }

  setScale(scale: number | Vec) {
    let scaleVec: Vec;
    if (typeof scale === 'number') {
      scaleVec = {
        x: scale,
        y: scale,
        z: scale
      };
    } else {
      scaleVec = scale;
    }
    this.group.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
    this.refresh();
  }

  refresh() {
    this.layer.update();
  }

  show() {
    this.group.visible = true;
    this.refresh();
  }

  hide() {
    this.group.visible = false;
    this.refresh();
  }

  animate() {
    this.animationFrame = requestAnimationFrame(() => {
      this.update();
      this.animate();
      if(!this.hasResetCenter && this.tilesRenderer.root){
        const box = new Box3()
        // 重置region的中心点
        if ( this.tilesRenderer.root && (this.tilesRenderer.root as any).boundingVolume.region ) {
          this.tilesRenderer.getOrientedBounds( box, this.parentGroup.matrix );
          this.parentGroup.matrix.decompose( this.parentGroup.position, this.parentGroup.quaternion, this.parentGroup.scale );
          this.parentGroup.position.set( 0, 0, 0 );
          this.parentGroup.quaternion.invert();
          this.parentGroup.scale.set( 1, 1, 1 );
        }
        this.group.updateMatrixWorld( false );
        // 获取中心点，将3dtiles加载的group的中心点重置，变成默认为0 0 0
        if ( this.tilesRenderer.getBounds( box ) ) {
          // 重置整体的坐标，转化为高德需要的投影坐标
          this.resetPosition(box);
          box.getCenter( this.tilesRenderer.group.position );
          this.tilesRenderer.group.position.multiplyScalar( - 1 );
          this.hasResetCenter = true;
        }
      }
    });
  }

  resetPosition(box: Box3){
    if(!this.position){
      // 从3dtiles盒模型中获取中心点坐标
      const center = new Vector3();
      box.getCenter(center);
      // 将中心点坐标转化为经纬度和海拔
      const result = convertToWGS84(center.x, center.y, center.z);
      // console.log('result: ', result)
      const lnglat = gps84_To_Gcj02(result.longitude, result.latitude);
      if(this.options.autoFocus){
        this.layer.getMap().setCenter(lnglat)
      }
      this.setPosition(lnglat);
      /*this.setTranslate({
        x:0,
        y:0,
        z: result.height
      })*/
      this.emit('autoPosition')
    }
  }

  update(){
    this.layer.getCamera().updateMatrixWorld();
    this.tilesRenderer?.update();
    this.layer.update()
    if(this.statsContainer){
      const tiles = this.tilesRenderer as any;
      this.statsContainer.innerHTML = `正在下载: ${ tiles.stats.downloading } 正在编译: ${ tiles.stats.parsing } 已显示: ${ tiles.group.children.length }`;
    }
  }

  getGroup(){
    return this.group
  }

  getTilesRenderer(){
    return this.tilesRenderer
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.unbindEvents()
    this.layer.remove(this.group)
    this.tilesRenderer?.dispose()
    this.group = null
    // this.tilesRenderer = undefined
    this.layer = null
    if(this.statsContainer){
      this.statsContainer.remove()
      this.statsContainer = undefined
    }
    /*if (this.object) {
      clearGroup(this.object);
      this.object = null;
      this.layer = null;
    }*/
  }

}

export {Layer3DTiles}
